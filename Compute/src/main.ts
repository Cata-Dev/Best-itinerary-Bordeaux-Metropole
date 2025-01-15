import "core-js/features/reflect";

import { AwaitableProps, Deferred } from "common/async";
import { makeLogger } from "common/logger";
import { isMainThread, Worker } from "node:worker_threads";
import { cpus } from "os";
import { join } from "path";
import { askShutdown, makeQueue } from "./base";
import { makeComputeData } from "./jobs/preCompute/compute";
import { makeComputeFpData } from "./jobs/preCompute/computeFp";
import { makeComputePTNData } from "./jobs/preCompute/computePTN";
import { isMessage, makeMessage, Message } from "./utils/para";
import { singleUseWorker } from "./utils/SingleUseWorker";

declare module "./utils/para" {
  interface Messages {
    data: {
      compute: ReturnType<makeComputeData>;
      computeFp: ReturnType<makeComputeFpData>;
      computePTN: ReturnType<makeComputePTNData>;
    };
    dataUpdate: Partial<Message<"data">["data"]>;
    stop: undefined;
  }
}

const logger = makeLogger(`[MAIN]`);

export async function main(workersCount: number, data?: Message<"data">["data"]) {
  const app = await makeQueue();
  app.logger = logger;

  // Cache
  let fpData = singleUseWorker<makeComputeFpData>(join(__dirname, "jobs/", "preCompute/", "computeFp.js"));
  const preComputeDataFor = async <T extends keyof Message<"dataUpdate">["data"]>(
    which: T[],
  ): Promise<Extract<Message<"dataUpdate">["data"], T>> => {
    const data: AwaitableProps<Message<"dataUpdate">["data"]> = {};

    if (which.find((w) => w === "compute"))
      data.compute = singleUseWorker<makeComputeData>(join(__dirname, "jobs/", "preCompute/", "compute.js"));

    if (which.find((w) => w === "computeFp")) {
      data.computeFp = fpData = singleUseWorker<makeComputeFpData>(
        join(__dirname, "jobs/", "preCompute/", "computeFp.js"),
      );
    }

    if (which.find((w) => w === "computePTN"))
      data.computePTN = singleUseWorker<makeComputePTNData>(
        join(__dirname, "jobs/", "preCompute/", "computePTN.js"),
        // Use cache
        await fpData,
      );

    // Await workers to resolve
    await Promise.all(Object.values(data));

    return data as Extract<Message<"dataUpdate">["data"], T>;
  };

  data ??= await preComputeDataFor(["compute"]);

  // Init main instance
  const workers = Array.from(
    { length: workersCount },
    () => new Worker(join(__dirname, "worker.js"), { workerData: makeMessage("data", data) }),
  );

  let count = 0;

  for (const worker of workers) {
    app.logger.log(`Starting W-${worker.threadId}`);

    // worker.on("message", (message) => app.logger.log(`[${worker.threadId}]`, message));

    worker.on("message", function started(message) {
      if (isMessage(message) && message.code !== "started") return;

      app.logger.log(`Started W-${worker.threadId}`);
      worker.removeListener("message", started);

      count++;
      if (count === workers.length) app.logger.info("All workers started.");
    });
  }

  return {
    app,
    /**
     * Should NOT be called multiple times in parallel, i.e., wait for the previous refresh to resolve
     */
    refreshData: async (which?: (keyof Message<"dataUpdate">["data"])[]) => {
      const data = await preComputeDataFor(which ?? ["compute", "computeFp", "computePTN"]);

      // Wait for all workers to have ack data before resolving
      const def = new Deferred<void>();
      let cnt = 0;
      workers.forEach((w) =>
        w.on("message", function dataAck(message) {
          if (!isMessage(message)) throw new Error("Unexpected message");
          if (message.code !== "dataAck") return;

          w.removeListener("message", dataAck);
          cnt++;
          if (cnt === workers.length) {
            app.logger.info("All workers got their data refreshed.");
            def.resolve();
          }
        }),
      );

      workers.forEach((w) => w.postMessage(makeMessage("dataUpdate", data)));

      return def.promise;
    },

    gracefulStop: () => {
      app.logger.info("Gracefully stopping...");

      const def = new Deferred();

      const workersStopped = new Promise<void>((res) => {
        let count = 0;

        for (const worker of workers) {
          worker.on("message", function stopped(message) {
            if (isMessage(message) && message.code !== "stopped") return;

            app.logger.log(`Stopped W-${worker.threadId}`);
            worker.removeListener("message", stopped);

            count++;
            if (count === workers.length) res();
          });

          worker.postMessage(makeMessage("stop", undefined));
        }
      });

      workersStopped.catch(app.logger.error).finally(() => {
        askShutdown(app).then(def.resolve).catch(def.reject);
      });

      return def.promise;
    },
  };
}

if (require.main === module && isMainThread) {
  logger.log(`Main starting...`);

  void main(cpus().length)
    .then(({ gracefulStop }) => {
      const askShutdown = () => {
        void gracefulStop;
        logger.info("Gracefully stopped, exiting.");
      };

      process.on("SIGTERM", askShutdown);
      process.on("SIGINT", askShutdown);

      logger.log(`Main started.`);
    })
    .catch(logger.error);
}
