import { FlowJob, FlowProducer, Queue, QueueBaseOptions, QueueEvents, Worker } from "bullmq";
import { makeLogger } from "common/logger";
import { ItineraryQuery } from "server";
import { config } from "data/lib/config";
import { mapAsync } from "./utils/asyncs";
import { JobData, JobName, JobResult, Processor } from "./jobs";
import { RAPTORRunSettings } from "raptor";
import { TBMEndpoints } from "server/externalAPIs/TBM/index";

export interface Config {
  redis: {
    host: string;
    port: number;
  };
  dbAddress: string;
  sourceDB: string;
  computeDB: string;
}

type SchedulerInstanceType = "queue" | "worker";
type Instances<
  Tuple extends [...JobName[]],
  T extends SchedulerInstanceType | "processor" | "queuesEvents",
> = {
  [Index in keyof Tuple]: T extends "queue"
    ? Queue<JobData<Tuple[Index]>, JobResult<Tuple[Index]>, Tuple[Index]>
    : T extends "worker"
      ? Worker<JobData<Tuple[Index]>, JobResult<Tuple[Index]>, Tuple[Index]>
      : T extends "processor"
        ? Processor<Tuple[Index]>
        : T extends "queuesEvents"
          ? QueueEvents
          : never;
};

const jobNames = ["compute", "computeFp", "computeFpOTA", "computeNSR"] as const satisfies JobName[];

export interface BaseApplication {
  readonly config: Config;
  /**
   * Feel free to override it with a custom logger (prefixes)
   */
  logger: ReturnType<typeof makeLogger>;
}

export type Application<T extends SchedulerInstanceType = SchedulerInstanceType> = BaseApplication &
  (T extends "queue"
    ? {
        queues: Instances<typeof jobNames, "queue">;
        queuesEvents: Instances<typeof jobNames, "queuesEvents">;
        computeFullJourney: (
          from: Extract<ItineraryQuery, { from: unknown }>["from"],
          to: Extract<ItineraryQuery, { to: unknown }>["to"],
          departureTime: Date,
          settings: Partial<RAPTORRunSettings>,
        ) => Promise<
          Omit<Awaited<ReturnType<InstanceType<typeof FlowProducer>["add"]>>, "job"> & {
            job: Awaited<ReturnType<Instances<typeof jobNames, "queue">["0"]["add"]>>;
          }
        >;
      }
    : T extends "worker"
      ? { workers: Instances<typeof jobNames, "worker"> }
      : never);

const logger = makeLogger();

export const app = {
  config: {
    ...config,
    ...config.compute,
  },
  logger,
} satisfies BaseApplication;

const connection = {
  ...app.config.redis,
} satisfies QueueBaseOptions["connection"];

type DistributedFlowJobBase<T> = T extends JobName ? FlowJobBase<T> : never;

interface FlowJobBase<N extends JobName> extends FlowJob {
  name: N;
  queueName: N;
  data: JobData<N>;
  children?: DistributedFlowJobBase<JobName>[];
}

export async function makeQueue() {
  const queues = jobNames.map((j) => new Queue(j, { connection })) as Instances<typeof jobNames, "queue">;
  // Enforce NSR to be done at most 1 by 1
  await queues[3].setGlobalConcurrency(1).catch(logger.error);

  await mapAsync(queues, (q) => q.waitUntilReady()).catch(logger.error);
  app.logger.log("Queue ready");

  const flowProducer = new FlowProducer({ connection });

  return {
    ...app,
    queues,
    queuesEvents: queues.map((q) => new QueueEvents(q.name, { connection })) as Instances<
      typeof jobNames,
      "queuesEvents"
    >,
    computeFullJourney: (from, to, departureTime, settings) =>
      flowProducer.add({
        name: "compute",
        queueName: "compute",
        data: [from, to, departureTime, settings],
        children: [
          ...(from.type === TBMEndpoints.Addresses
            ? [
                {
                  name: "computeFpOTA" as const,
                  queueName: "computeFpOTA" as const,
                  data: [from.coords, "ps"] satisfies [(typeof from)["coords"], unknown],
                  opts: {
                    failParentOnFailure: true,
                  },
                },
              ]
            : []),
          ...(to.type === TBMEndpoints.Addresses
            ? [
                {
                  name: "computeFpOTA" as const,
                  queueName: "computeFpOTA" as const,
                  data: [to.coords, "pt"] satisfies [(typeof from)["coords"], unknown],
                  opts: {
                    failParentOnFailure: true,
                  },
                },
              ]
            : []),
        ],
      } satisfies FlowJobBase<"compute">),
  } as Application<"queue">;
}

// TODO: add to config ?
// 30 minutes
const MAX_STALL_TIME = 30 * 60 * 1_000;

export function makeWorker(
  /**
   *  Should be `Instances<typeof jobNames, "processor">`
   */
  processors: Instances<typeof jobNames, "processor">,
) {
  const workers = jobNames.map(
    (n, i) =>
      new Worker(n, (processors as Processor<JobName>[])[i], {
        connection,
        stalledInterval: MAX_STALL_TIME,
        lockDuration: MAX_STALL_TIME,
      }),
  ) as Instances<typeof jobNames, "worker">;

  mapAsync(workers, (w) => w.waitUntilReady())
    .then(() => app.logger.log("Workers ready"))
    .catch(logger.error);

  return { ...app, workers } satisfies Application<"worker">;
}

export function askShutdown(app: Application) {
  return new Promise<string>((res, rej) => {
    mapAsync(
      "queues" in app ? app.queues : (app.workers as Instances<typeof jobNames, SchedulerInstanceType>),
      (i) => i.close(),
    )
      .then(() => {
        res("Instance stopped");
      })
      .catch(rej);
  });
}
