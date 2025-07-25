type UnionToIntersection<U> = (U extends never ? never : (arg: U) => never) extends (arg: infer I) => void
  ? I
  : never;

type UnionToTuple<T> =
  UnionToIntersection<T extends never ? never : (t: T) => T> extends (_: never) => infer W
    ? [...UnionToTuple<Exclude<T, W>>, W]
    : [];

/**
 * Initialize every property of {@link obj} defined in {@link defaults}.
 * @param obj Object to initialize its properties
 * @param defaults Default properties
 * @returns New object based from {@link obj} with initialized properties
 */
function withDefaults<O extends object>(obj: Partial<O>, defaults: O): O {
  return (Object.keys(defaults) as (keyof O)[]).reduce(
    (acc, k) => (k in acc ? acc : ((acc[k] = defaults[k]), acc)),
    structuredClone(obj),
  ) as O;
}

export { withDefaults };
export type { UnionToTuple };
