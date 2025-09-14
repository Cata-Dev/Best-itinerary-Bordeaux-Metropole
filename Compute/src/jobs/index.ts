import { Processor as BullProcessor } from "bullmq";
import { BaseApplication } from "../base";
// Force import to resolve Jobs type
import "./compute";
import "./computeFp";

/** `JobName: JobData` */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Jobs {}

export type JobName = keyof Jobs;
export type JobData<J extends JobName> = Parameters<Jobs[J]>;
export type JobResult<J extends JobName> = ReturnType<Jobs[J]>;
export type Processor<J extends JobName> = BullProcessor<JobData<J>, JobResult<J>, J>;

export type JobFn<J extends JobName> = (app: BaseApplication) => Promise<Processor<J>> | Processor<J>;
