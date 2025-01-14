function limiter(max: number) {
  let n = 0;
  const promises: Promise<unknown>[] = [];

  return (prom: Promise<unknown>, throttle: number): Promise<unknown[]> | void => {
    n += throttle;
    promises.push(prom);

    if (n >= max) {
      // Throttled
      const prom = Promise.all(promises);
      void prom.then(() => ((n = 0), promises.splice(0, promises.length)));

      return prom;
    }
  };
}

export { limiter };
