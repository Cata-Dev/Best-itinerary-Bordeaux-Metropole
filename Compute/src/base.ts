import { makeLogger } from "common/lib/logger";
import { Queue, QueueBaseOptions, Worker } from "bullmq";
import config from "../config.json";
import { mapAsync } from "./utils/asyncs";
import { JobData, JobName, JobResult, Processor } from "./jobs";

export interface Config {
  redis: {
    host: string;
    port: number;
  };
  dbAddress: string;
  sourceDataDB: string;
  mainDB: string;
}

type InstanceType = "queue" | "worker";
type Instances<Tuple extends [...JobName[]], T extends InstanceType | "processor"> = {
  [Index in keyof Tuple]: T extends "queue"
    ? Queue<JobData<Tuple[Index]>, JobResult<Tuple[Index]>, Tuple[Index]>
    : T extends "worker"
      ? Worker<JobData<Tuple[Index]>, JobResult<Tuple[Index]>, Tuple[Index]>
      : T extends "processor"
        ? Processor<Tuple[Index]>
        : never;
};

const jobNames = ["compute"] as const satisfies JobName[];

export interface BaseApplication {
  readonly config: Config;
  /**
   * Feel free to override it with a custom logger (prefixes)
   */
  logger: ReturnType<typeof makeLogger>;
}

export type Application<T extends InstanceType = InstanceType> = BaseApplication &
  (T extends "queue"
    ? { queues: Instances<typeof jobNames, "queue"> }
    : T extends "worker"
      ? { workers: Instances<typeof jobNames, "worker"> }
      : never);

const logger = makeLogger();

export const app = {
  config,
  logger,
} satisfies BaseApplication;

const connection = {
  ...app.config.redis,
} satisfies QueueBaseOptions["connection"];

export function makeQueue() {
  const queues = jobNames.map((j) => new Queue(j, { connection })) as Instances<typeof jobNames, "queue">;

  mapAsync(queues, (q) => q.waitUntilReady())
    .then(() => app.logger.log("Queue ready"))
    .catch(logger.error);

  return { ...app, queues } satisfies Application<"queue">;
}

export function makeWorker(processors: Instances<typeof jobNames, "processor">) {
  const workers = jobNames.map(
    (n, i) =>
      new Worker(n, processors[i], {
        connection,
      }),
  ) as Instances<typeof jobNames, "worker">;

  mapAsync(workers, (w) => w.waitUntilReady())
    .then(() => app.logger.log("Workers ready"))
    .catch(logger.error);

  return { ...app, workers } satisfies Application<"worker">;
}

export function askShutdown(app: Application) {
  return new Promise<string>((res, rej) => {
    mapAsync("queues" in app ? app.queues : (app.workers as Instances<typeof jobNames, InstanceType>), (i) =>
      i.close(),
    )
      .then(() => {
        res("Instance stopped");
      })
      .catch(rej);
  });
}
