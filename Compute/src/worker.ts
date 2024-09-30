import { isMainThread, parentPort } from "node:worker_threads";
import { getHeapStatistics } from "v8";
import { app, askShutdown } from "./base";
import initComputeJob from "./jobs/compute";

async function start() {
  await app.agenda.ready;

  await initComputeJob(app);

  app.agenda.on("start", (job) => {
    console.log(`Job ${job.attrs.name} starting`);
  });
  app.agenda.on("complete", (job) => {
    console.log(`Job ${job.attrs.name} finished`);
  });
  app.agenda.on("fail", (err, job) => {
    console.log(`Job ${job.attrs.name} failed`, err);
  });
  await app.agenda.start();
}

function gracefulStop() {
  askShutdown()
    .catch((err) => console.error("Error during shutdown", err))
    .finally(() => process.exit(0));
}

if (isMainThread) {
  // Manually started
  start().catch(console.error);

  process.on("SIGTERM", gracefulStop);
  process.on("SIGINT", gracefulStop);
} else if (parentPort) {
  // Worker spawned by code
  parentPort.on("message", (message) => {
    switch (message) {
      case "start":
        void start()
          .then(() => parentPort?.postMessage({ code: "started" }))
          .catch((err) => console.error("Error during startup", err));
        break;

      case "stop":
        void askShutdown()
          .catch((err) => console.error("Error during shutdown", err))
          .finally(() => {
            parentPort?.postMessage({ code: "stopped" });
            process.exit(0);
          });
        break;

      case "memory":
        parentPort?.postMessage({
          code: "memory",
          data: getHeapStatistics().total_heap_size / 1e6,
        });
    }
  });
}
