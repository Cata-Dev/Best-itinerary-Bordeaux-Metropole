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

/**
 * @description Wrap a map of promises into one promise
 */
export async function mapAsync<I, O>(
  array: I[],
  callback: (value: I, index: number, array: I[]) => Promise<O>,
): Promise<O[]> {
  return await Promise.all(array.map(callback));
}

/**
 * Asynchronously pause code
 * @param ms Time to wait, defaults to 1s
 * @returns Promise to await
 * @example await wait(1_000) // Pause code execution for 1s
 */
export function wait(ms = 1000): Promise<void> {
  const defP = new Deferred<void>();

  setTimeout(() => {
    defP.resolve();
  }, ms);

  return defP.promise;
}
