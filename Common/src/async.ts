type resolveCb<T = void> = (value: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type rejectCb = (reason?: any) => void;
class Deferred<T = unknown> {
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
async function mapAsync<I, O>(
  array: I[],
  callback: (value: I, index: number, array: I[]) => Promise<O>,
): Promise<O[]> {
  return await Promise.all(array.map(callback));
}

/**
 * @description Wrap a set of promises into one promise
 */
async function reduceAsync<I, O>(
  array: I[],
  callback: (previousValue: O, currentValue: I, currentIndex: number, array: I[]) => Promise<O>,
  initialValue: O,
): Promise<O> {
  let acc = initialValue;
  for (const [idx, el] of array.entries()) acc = await callback(acc, el, idx, array);

  return acc;
}

/**
 * Asynchronously pause code
 * @param ms Time to wait, defaults to 1s
 * @returns Promise to await
 * @example await wait(1_000) // Pause code execution for 1s
 */
function wait(ms = 1000): Promise<void> {
  const defP = new Deferred<void>();

  setTimeout(() => {
    defP.resolve();
  }, ms);

  return defP.promise;
}

type AwaitableProps<T extends Record<string | number | symbol, unknown>> = {
  [k in keyof T]: T[k] | Promise<T[k]>;
};

export { Deferred, mapAsync, reduceAsync, wait };
export type { AwaitableProps, rejectCb, resolveCb };
