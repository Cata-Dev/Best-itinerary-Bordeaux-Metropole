import { parentPort, threadId, workerData } from "node:worker_threads";
import { makeLogger } from "common/logger";
import { app as bApp, askShutdown, makeWorker, Application } from "./base";
import initComputeJob from "./jobs/compute";
import { Message, isMessage, makeMessage } from "./utils/para";

declare module "./utils/para" {
  interface Messages {
    started: undefined;
    stopped: undefined;
  }
}

async function start(data: Message<"data">["data"]) {
  const { init, updateData } = initComputeJob(data);

  const computeProc = await init(bApp);
  bApp.logger.log("Compute job initialized.");

  const app = makeWorker([computeProc]);

  app.workers.forEach((worker) => {
    worker.on("active", (job) => {
      bApp.logger.log(`Job ${job.name} starting`);
    });
    worker.on("completed", (job) => {
      bApp.logger.info(`Job ${job.name} finished`);
    });
    worker.on("failed", (job, err) => {
      bApp.logger.error(`Job ${job?.name ?? "UNKNOWN"} failed`, err);
    });
    worker.on("closing", (msg) => {
      bApp.logger.log(`Worker ${worker.name} closing`, msg);
    });
    worker.on("closed", () => {
      bApp.logger.log(`Worker ${worker.name} closed`);
    });
  });

  return { app, updateData };
}

if (parentPort) {
  bApp.logger = makeLogger(`[W-${threadId}]`);

  const init = new Promise<{
    updateData: ReturnType<typeof initComputeJob>["updateData"];
    app: Application<"worker">;
  }>((res, rej) => {
    bApp.logger.info("Starting...");

    if (!isMessage(workerData) || workerData.code !== "data") {
      return rej(new Error("Invalid init data."));
    }

    start(workerData.data)
      .then((fun) => {
        res(fun);
        bApp.logger.info("Started.");
        parentPort?.postMessage(makeMessage("started", undefined));
      })
      .catch((err) => bApp.logger.error("Error during startup", err));
  });

  // Worker spawned by code
  parentPort.on("message", (message) => {
    if (!isMessage(message)) return;

    switch (message.code) {
      case "data":
        void init.then(({ updateData }) => updateData(message.data));
        bApp.logger.info("Refreshed data.");

        break;

      case "stop":
        void init.then(({ app }) => {
          void askShutdown(app)
            .then(() => bApp.logger.info("Gracefully stopped."))
            .catch((err) => bApp.logger.error("Error during shutdown", err))
            .finally(() => {
              parentPort?.postMessage(makeMessage("stopped", undefined));
              process.exit(0);
            });
        });
        break;
    }
  });
}
