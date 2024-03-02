export type resolveCb<T = void> = (value: T) => void;
export type rejectCb = (reason?: unknown) => void;

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

export function wait(ms = 1000): Promise<unknown> {
  const defP = new Deferred();

  setTimeout(() => {
    defP.resolve(null);
  }, ms);

  return defP.promise;
}

export async function mapAsync<I, O>(array: I[], callback: (value: I, index: number, array: I[]) => Promise<O>): Promise<O[]> {
  return await Promise.all(array.map(callback));
}
