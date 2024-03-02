import type { IJobDefinition, JobWithId } from "@hokify/agenda";
import { Agenda as OriginalAgenda, Job as OriginalJob } from "@hokify/agenda";
import type { JobPriority } from "@hokify/agenda/dist/utils/priority";
import type { JobData, JobName } from "./jobs";

export type Job<J extends JobName> = OriginalJob<JobData<J>>;

export type JobWithId<J extends JobName> = Job<JobData<J>> & {
  attrs: {
    _id: ObjectId;
  };
};

export abstract class Agenda extends OriginalAgenda {
  on<J extends JobName>(event: `start:${J}`, listener: (job: JobWithId<J>) => void): this;
  on<J extends JobName>(event: `complete:${J}`, listener: (job: JobWithId<J>) => void): this;
  on<J extends JobName>(event: `success:${J}`, listener: (job: JobWithId<J>) => void): this;
  on<J extends JobName>(event: `fail:${J}`, listener: (error: Error, job: JobWithId<J>) => void): this;

  on(event: "processJob", listener: (job: JobWithId) => void): this;
  on(event: "fail", listener: (error: Error, job: JobWithId) => void): this;
  on(event: "success", listener: (job: JobWithId) => void): this;
  on(event: "start", listener: (job: JobWithId) => void): this;
  on(event: "complete", listener: (job: JobWithId) => void): this;
  on(event: "ready", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  /**
   * Creates a scheduled job with given interval and name/names of the job to run
   * @param interval
   * @param names
   * @param data
   * @param options
   */
  abstract every<J extends JobName>(
    interval: string | number,
    name: J,
    data: JobData<J>,
    options?: {
      timezone?: string;
      skipImmediate?: boolean;
      forkMode?: boolean;
    },
  ): Promise<Job<J>>;

  /**
   * Create a job for this exact moment
   * @param name
   */
  now<J extends JobName>(name: J, data: JobData<J>): Promise<Job<J>>;

  /**
   * Setup definition for job
   * Method is used by consumers of lib to setup their functions
   * BREAKING CHANGE in v4: options moved from 2nd to 3rd parameter!
   * @param name
   * @param processor
   * @param options
   */
  define<J extends JobName>(
    name: J,
    processor: (agendaJob: Job<J>, done: (error?: Error) => void) => void,
    options?: Partial<Pick<IJobDefinition, "lockLimit" | "lockLifetime" | "concurrency">> & {
      priority?: JobPriority;
    },
  ): void;
  define<J extends JobName>(
    name: J,
    processor: (agendaJob: Job<J>) => Promise<void>,
    options?: Partial<Pick<IJobDefinition, "lockLimit" | "lockLifetime" | "concurrency">> & {
      priority?: JobPriority;
    },
  ): void;
}
