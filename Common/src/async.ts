export type resolveCb<T = void> = (value: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type rejectCb = (reason?: any) => void;
export class Deferred<T = unknown> {
  public promise: Promise<T>;
  public resolve!: resolveCb<T>;
  public reject!: rejectCb;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}
