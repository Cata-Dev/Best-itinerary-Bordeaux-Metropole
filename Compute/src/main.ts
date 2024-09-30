import { isMainThread, Worker } from "node:worker_threads";
import { cpus } from "os";

function isMessage(message: unknown): message is { code: string; data?: unknown } {
  return (
    typeof message === "object" &&
    message !== null &&
    "code" in message &&
    typeof message.code === "string" &&
    "data" in message
  );
}

if (isMainThread) {
  // Init main instance
  const workers = Array.from({ length: cpus().length }, () => new Worker("./worker.js"));
  for (const worker of workers) {
    console.log(`[${worker.threadId}] Starting`);

    worker.on("message", (message) => console.log(`[${worker.threadId}]`, message));

    worker.on("message", function started(message) {
      if (isMessage(message) && message.code !== "started") return;

      console.log(`[${worker.threadId}] Started`);
      worker.removeListener("message", started);

      // Benchmark memory
      worker.postMessage("memory");
      console.log(process.memoryUsage.rss() / 1e6);
    });
    worker.postMessage("start");
  }
}
