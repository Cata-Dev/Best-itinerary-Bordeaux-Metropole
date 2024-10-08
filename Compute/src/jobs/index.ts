import type { Application } from "../base";

/** `JobName: JobData` */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Jobs {}

export type JobName = keyof Jobs;
export type JobData<J extends JobName> = Parameters<Jobs[J]>;
export type JobResult<J extends JobName> = ReturnType<Jobs[J]>;

export type jobFn<R = unknown> = (app: Application) => Promise<R> | R;
