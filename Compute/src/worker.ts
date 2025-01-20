import "core-js/features/reflect";

import { Logger } from "@bibm/common/logger";
import { parentPort, threadId, workerData } from "node:worker_threads";
import { Application, askShutdown, app as bApp, makeWorker } from "./base";
import initComputeJob from "./jobs/compute";
import initComputeFpJob from "./jobs/computeFp";
import { Message, isMessage, makeMessage } from "./utils/para";

declare module "./utils/para" {
  interface Messages {
    started: undefined;
    dataAck: undefined;
  }
}

async function start(data: Message<"data">["data"]) {
  const { init, updateData } = initComputeJob(data.compute);

  const computeProc = await init(bApp);
  bApp.logger.log("Compute job initialized.");

  const { fp, fpOTA, computeNSR, updateFpData, updatePTNData } = await initComputeFpJob(
    bApp,
    data.computeFp,
    data.computePTN,
  );

  const app = makeWorker([computeProc, fp, fpOTA, computeNSR]);

  app.workers.forEach((worker) => {
    worker.on("active", (job) => {
      bApp.logger.log(`Job ${job.name} starting`);
    });
    worker.on("completed", (job) => {
      bApp.logger.info(`Job ${job.name} finished`);
    });
    worker.on("stalled", (jobId) => {
      bApp.logger.warn(`Job ${jobId} stalled`);
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

  return { app, updateData, updateFpData, updatePTNData };
}

if (parentPort) {
  bApp.logger = new Logger(bApp.logger, `[W-${threadId}]`);

  const init = new Promise<{
    updateData: ReturnType<typeof initComputeJob>["updateData"];
    updateFpData: Awaited<ReturnType<typeof initComputeFpJob>>["updateFpData"];
    updatePTNData: Awaited<ReturnType<typeof initComputeFpJob>>["updatePTNData"];
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
    if (!isMessage(message)) throw new Error("Unexpected message");

    switch (message.code) {
      case "data":
        void init.then(({ updateData, updateFpData, updatePTNData }) => {
          updateData(message.data.compute);
          updateFpData(message.data.computeFp);
          updatePTNData(message.data.computePTN);
          bApp.logger.info("Refreshed data.");
          parentPort?.postMessage(makeMessage("dataAck", undefined));
        });

        break;

      case "dataUpdate": {
        void init.then(({ updateData, updateFpData, updatePTNData }) => {
          if (message.data.compute) updateData(message.data.compute);
          if (message.data.computeFp) updateFpData(message.data.computeFp);
          if (message.data.computePTN) updatePTNData(message.data.computePTN);
          bApp.logger.info("Refreshed data.");
          parentPort?.postMessage(makeMessage("dataAck", undefined));
        });

        break;
      }

      case "stop":
        void init.then(({ app }) => {
          void askShutdown(app)
            .then(() => bApp.logger.info("Gracefully stopped."))
            .catch((err) => bApp.logger.error("Error during shutdown", err))
            .finally(() => process.exit(0));
        });
        
        break;
    }
  });
}
