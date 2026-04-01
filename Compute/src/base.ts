import { mapAsync } from "@bibm/common/async";
import { Logger } from "@bibm/common/logger";
import { UnionToTuple } from "@bibm/common/types";
import { config } from "@bibm/data/config/index";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import { JourneyQuery } from "@bibm/server";
import { FlowJob, FlowProducer, Queue, QueueBaseOptions, QueueEvents, Worker, WorkerOptions } from "bullmq";
import { RAPTORRunSettings } from "raptor";
import { JobData, JobName, JobResult, Processor } from "./jobs";

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

interface JobSettings<J extends JobName> {
  name: J;
  settings: Omit<WorkerOptions, "connection">;
}
type DistributeJobSettings<J extends JobName> = J extends JobName ? JobSettings<J> : never;

// TODO: add to config ?
// 30 minutes
const COMPUTENSR_MAX_TIME = 30 * 60 * 1_000;
// 1 minute
const COMPUTE_MAX_TIME = 1 * 60 * 1_000;

const jobs = [
  { name: "compute", settings: { stalledInterval: COMPUTE_MAX_TIME, lockDuration: COMPUTE_MAX_TIME } },
  {
    name: "computeFp",
    settings: {},
  },
  { name: "computeFpOTA", settings: {} },
  {
    name: "computeNSR",
    settings: { stalledInterval: COMPUTENSR_MAX_TIME, lockDuration: COMPUTENSR_MAX_TIME },
  },
] as const satisfies UnionToTuple<DistributeJobSettings<JobName>>;

export interface BaseApplication {
  readonly config: Config;
  /**
   * Feel free to override it with a custom logger (prefixes)
   */
  logger: Logger;
}

export type Application<T extends SchedulerInstanceType = SchedulerInstanceType> = BaseApplication &
  (T extends "queue"
    ? {
        queues: Instances<UnionToTuple<JobName>, "queue">;
        queuesEvents: Instances<UnionToTuple<JobName>, "queuesEvents">;
        computeFullJourney: (
          from: Extract<JourneyQuery, { from: unknown }>["from"],
          to: Extract<JourneyQuery, { to: unknown }>["to"],
          departureTime: Date,
          settings: Partial<RAPTORRunSettings>,
        ) => Promise<
          Omit<Awaited<ReturnType<InstanceType<typeof FlowProducer>["add"]>>, "job"> & {
            job: Awaited<ReturnType<Instances<UnionToTuple<JobName>, "queue">["0"]["add"]>>;
          }
        >;
      }
    : T extends "worker"
      ? { workers: Instances<UnionToTuple<JobName>, "worker"> }
      : never);

const logger = new Logger("[COMPUTE]");

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
  const queues = jobs.map((j) => new Queue(j.name, { connection })) as Instances<
    UnionToTuple<JobName>,
    "queue"
  >;
  // Enforce NSR to be done at most 1 by 1
  await queues[3].setGlobalConcurrency(1).catch((err) => logger.error(err));

  mapAsync(queues, (q) => q.waitUntilReady())
    .then(() => app.logger.log("Queues ready"))
    .catch((err) => app.logger.error(err));

  const flowProducer = new FlowProducer({ connection });

  return {
    ...app,
    queues,
    queuesEvents: queues.map((q) => new QueueEvents(q.name, { connection })) as Instances<
      UnionToTuple<JobName>,
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
                  data: [from.coords, "ps", { targetPTN: true }] satisfies [unknown, unknown, unknown],
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
                  data: [to.coords, "pt", { targetPTN: true }] satisfies [unknown, unknown, unknown],
                  opts: {
                    failParentOnFailure: true,
                  },
                },
              ]
            : []),
          ...(from.type === TBMEndpoints.Addresses && to.type === TBMEndpoints.Addresses
            ? [
                {
                  name: "computeFp" as const,
                  queueName: "computeFp" as const,
                  data: [from.coords, to.coords] satisfies [unknown, unknown],
                  opts: {
                    failParentOnFailure: false,
                  },
                },
              ]
            : []),
        ],
      } satisfies FlowJobBase<"compute">),
  } as Application<"queue">;
}

export function makeWorker(processors: Instances<UnionToTuple<JobName>, "processor">) {
  const workers = jobs.map(
    (j, i) =>
      new Worker(j.name, (processors as Processor<JobName>[])[i], {
        connection,
        ...j.settings,
      }),
  ) as Instances<UnionToTuple<JobName>, "worker">;

  mapAsync(workers, (w) => w.waitUntilReady())
    .then(() => app.logger.log("Workers ready"))
    .catch((err) => app.logger.error(err));

  return { ...app, workers } satisfies Application<"worker">;
}

export function askShutdown(app: Application) {
  return new Promise<string>((res, rej) => {
    mapAsync(
      "queues" in app ? app.queues : (app.workers as Instances<UnionToTuple<JobName>, SchedulerInstanceType>),
      (i) => i.close(),
    )
      .then(() => {
        res("Instance stopped");
      })
      .catch(rej);
  });
}
