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

export { binarySearch };
