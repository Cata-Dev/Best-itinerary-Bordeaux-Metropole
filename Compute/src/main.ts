import { isMainThread, Worker } from "node:worker_threads";
import { cpus } from "os";
import { join } from "path";
import { app } from "./base";
import { isMessage, makeMessage } from "./utils/para";
import { makeData } from "./prepare";
import { makeLogger } from "common/lib/logger";

declare module "./utils/para" {
  interface Messages {
    data: Awaited<ReturnType<typeof makeData>>;
  }
}

app.logger = makeLogger(`[MAIN]`);

async function main() {
  const data = await makeData(app);

  // Init main instance
  const workers = Array.from(
    { length: cpus().length },
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
    gracefulStop: () => {
      app.logger.info("Gracefully stopping...");

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
        app.logger.info("Gracefully stopped, exiting.");
        process.exit(0);
      });
    },
  };
}

if (isMainThread) {
  app.logger.log(`Main starting...`);

  main()
    .then(({ gracefulStop }) => {
      process.on("SIGTERM", gracefulStop);
      process.on("SIGINT", gracefulStop);

      app.logger.log(`Main started.`);
    })
    .catch(app.logger.error);
}
