import type { Ref } from "@typegoose/typegoose";
import type { RefType } from "@typegoose/typegoose/lib/types";

type UnpackRefType<T> =
  T extends Ref<infer D>
    ? D extends {
        _id?: RefType;
      }
      ? D["_id"]
      : never
    : T extends Ref<infer D>[]
      ? D extends {
          _id?: RefType;
        }
        ? D["_id"][]
        : never
      : never;

type PopulateRef<T> = T extends Ref<infer D> ? D : T extends Ref<infer D>[] ? D[] : never;

type UnionToIntersection<U> = (U extends never ? never : (arg: U) => never) extends (arg: infer I) => void
  ? I
  : never;

type UnionToTuple<T> =
  UnionToIntersection<T extends never ? never : (t: T) => T> extends (_: never) => infer W
    ? [...UnionToTuple<Exclude<T, W>>, W]
    : [];

/**
 * @description Search for a value in a **sorted** array, in O(log2(n)).
 * @param arr The **sorted** array where performing the search
 * @param el The element to look for, which will be compared
 * @param compare A compare function that takes 2 arguments : `a` el and `b` an element of the array.
 * It returns :
 *    - a negative number if `a` is before `b`;
 *    - 0 if `a` is equal to `b`;
 *    - a positive number of `a` is after `b`.
 * @returns The index of el if positive ; index of insertion if negative
 */
function binarySearch<T, C>(arr: T[], el: C, compare: (a: C, b: T) => number) {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = (high + low) >> 1; // x >> 1 == Math.floor(x/2)
    const cmp = compare(el, arr[mid]);
    if (cmp > 0) {
      low = mid + 1;
    } else if (cmp < 0) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return ~low; // ~x == -x-1
}

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

export { binarySearch, withDefaults };
export type { PopulateRef, UnionToTuple, UnpackRefType };
