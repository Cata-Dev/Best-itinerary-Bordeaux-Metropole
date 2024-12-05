import "core-js/features/reflect";

import { isMainThread, Worker } from "node:worker_threads";
import { cpus } from "os";
import { join } from "path";
import { askShutdown, makeQueue } from "./base";
import { isMessage, makeMessage, Message } from "./utils/para";
import { makeData } from "./prepare";
import { Deferred } from "common/async";
import { makeLogger } from "common/logger";

declare module "./utils/para" {
  interface Messages {
    data: Awaited<ReturnType<typeof makeData>>;
    stop: undefined;
  }
}

const logger = makeLogger(`[MAIN]`);

export async function main(workersCount: number, data?: Message<"data">["data"]) {
  const app = await makeQueue();
  app.logger = logger;

  data ??= await makeData(app);

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
    updateData: (data: Message<"data">["data"]) =>
      workers.forEach((w) => w.postMessage(makeMessage("data", data))),

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
