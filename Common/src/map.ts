function getOrDefault<K, V>(map: Map<K, V>, key: K, deferredDefault: () => V): V {
  let val = map.get(key);
  if (val !== undefined) return val;

  val = deferredDefault();
  map.set(key, val);
  return val;
}

async function getOrAsyncDefault<K, V>(
  map: Map<K, V>,
  key: K,
  deferredDefault: () => Promise<V>,
): Promise<V> {
  let val = map.get(key);
  if (val !== undefined) return val;

  val = await deferredDefault();
  map.set(key, val);
  return val;
}

export { getOrAsyncDefault, getOrDefault };
