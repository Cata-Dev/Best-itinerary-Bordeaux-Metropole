function memoize<A extends unknown[], R>(f: (...args: A) => R) {
  const cache = new Map<string, R>();

  return (...args: A): R => {
    const cacheKey = args.map(String).join("");
    let cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    cached = f(...args);
    cache.set(cacheKey, cached);
    return cached;
  };
}

export { memoize };
