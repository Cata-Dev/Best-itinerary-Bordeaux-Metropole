/**
 * Simple cache for a single data without TTL, like an updating wrapper
 */
class Cache<D, I> {
  private _lastUpdate = -1;

  constructor(
    private data: D,
    private internal: I,
    private readonly freshness: (internal: I) => number | Promise<number>,
    private readonly update: (internal: I) => D | Promise<D>,
  ) {}

  async get() {
    let updated = false;

    if ((await this.freshness(this.internal)) > this._lastUpdate) {
      this.data = await this.update(this.internal);
      this._lastUpdate = Date.now();
      updated = true;
    }

    return [
      updated,
      this._lastUpdate,
      /** Do NOT edit this one or it will make side-effects */
      this.data,
    ] as const;
  }

  get lastUpdate() {
    return this._lastUpdate;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheData<C extends Cache<any, any>> = C extends Cache<infer D, any> ? D : never;

/**
 * Memoize a function, i.e., remember the result of a call to cache further identical calls
 * @param f Function to memoize,
 * plus an additional argument in 1st position to remove a memoized call, hence refreshing the cached call.
 * @param serialize An optional function to serialize the arguments of an initial functional call
 * (i.e., efficiently transform arguments in an identical representation).
 * Defaults to string cast and concatenation.
 * @returns The initial function, memoized
 */
function memoize<A extends unknown[], R>(
  f: (remove: () => void, ...args: A) => R,
  serialize: (...args: A) => number | string | symbol = (...args: A) => args.map(String).join(""),
) {
  const cache = new Map<number | string | symbol, R>();

  return (...args: A): R => {
    const cacheKey = serialize(...args);
    let cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    cached = f(() => cache.delete(cacheKey), ...args);
    cache.set(cacheKey, cached);
    return cached;
  };
}

export { Cache, memoize };
export type { CacheData };
