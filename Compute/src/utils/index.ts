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
