import { parentPort, threadId, workerData } from "node:worker_threads";
import { makeLogger } from "common/lib/logger";
import { app, askShutdown } from "./base";
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

  await app.agenda.ready;

  await init(app);
  app.logger.log("Compute job initialized.");

  app.agenda.on("start", (job) => {
    app.logger.log(`Job ${job.attrs.name} starting`);
  });
  app.agenda.on("complete", (job) => {
    app.logger.info(`Job ${job.attrs.name} finished`);
  });
  app.agenda.on("fail", (err, job) => {
    app.logger.error(`Job ${job.attrs.name} failed`, err);
  });

  app.agenda
    .start()
    .then(() => app.logger.info(`Agenda started.`))
    .catch(app.logger.error);

  return updateData;
}

if (parentPort) {
  app.logger = makeLogger(`[W-${threadId}]`);
  const updateData = new Promise<ReturnType<typeof initComputeJob>["updateData"]>((res, rej) => {
    app.logger.info("Starting...");

    if (!isMessage(workerData) || workerData.code !== "data") {
      return rej(new Error("Invalid init data."));
    }

    start(workerData.data)
      .then((fun) => {
        res(fun);
        app.logger.info("Started.");
        parentPort?.postMessage(makeMessage("started", undefined));
      })
      .catch((err) => app.logger.error("Error during startup", err));
  });

  // Worker spawned by code
  parentPort.on("message", (message) => {
    if (!isMessage(message)) return;

    switch (message.code) {
      case "data":
        void updateData.then((fun) => fun(message.data));
        app.logger.info("Refreshed data.");

        break;

      case "stop":
        void askShutdown()
          .then(() => app.logger.info("Gracefully stopped."))
          .catch((err) => app.logger.error("Error during shutdown", err))
          .finally(() => {
            parentPort?.postMessage(makeMessage("stopped", undefined));
            process.exit(0);
          });
        break;
    }
  });
}
