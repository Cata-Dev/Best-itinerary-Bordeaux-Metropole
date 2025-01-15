import { Worker } from "node:worker_threads";
import { Deferred } from "./async";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function singleUseWorker<C extends (...args: any[]) => any>(path: string, ...data: Parameters<C>) {
  const worker = new Worker(path, { workerData: data });

  const def = new Deferred<ReturnType<C>>();

  worker.once("message", (result: ReturnType<C>) => def.resolve(result));
  worker.once("error", (err) => def.reject(err));

  return def.promise;
}

export { singleUseWorker };
