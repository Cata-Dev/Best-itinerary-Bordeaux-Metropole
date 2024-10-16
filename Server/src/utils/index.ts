type supportedBulkOp = "updateOne" | "deleteOne";
export function formatDocToBulkOps<D extends Record<string, unknown>>(
  op: supportedBulkOp,
  doc: D,
  filterKeys: (keyof D)[],
) {
  switch (op) {
    case "updateOne":
      return {
        updateOne: {
          filter: filterKeys.reduce(
            (acc, v) => ({
              ...acc,
              [v]: doc[v],
            }),
            {},
          ),
          update: doc,
          upsert: true,
        },
      };

    case "deleteOne":
      return {
        deleteOne: {
          filter: filterKeys.reduce(
            (acc, v) => ({
              ...acc,
              [v]: doc[v],
            }),
            {},
          ),
        },
      };
  }
}

/**
 * @description Format documents to be operated via bulkWrite
 */
export function bulkOps<D extends Record<string, unknown>>(
  op: supportedBulkOp,
  documents: D[],
  filterKeys: (keyof D)[] = ["_id"],
) {
  return documents.map((doc) => formatDocToBulkOps(op, doc, filterKeys));
}

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
export function binarySearch<T, C>(arr: T[], el: C, compare: (a: C, b: T) => number) {
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

export const sumObj = <T extends number>(obj: Record<string, T> = {}, keys = []) => {
  return keys
    .map((k) => String(k))
    .filter((k) => k in obj)
    .reduce((acc, v) => acc + obj[v], 0);
};

/**
 * @param {Date} date
 * @param {boolean} includeMs Un booléen indiquant s'il faut inclure les millisecondes
 * @returns {string} Une date au format "HH:MiMi:SS"
 */
export function compactDate(date: Date | number, includeMs: boolean): string {
  if (!(date instanceof Date)) date = new Date(date);
  try {
    let h: number | string = date.getHours();
    let mi: number | string = date.getMinutes();
    let s: number | string = date.getSeconds();
    let ms: number | string = date.getMilliseconds();

    if (h < 10) h = "0" + h;
    if (mi < 10) mi = "0" + mi;
    if (s < 10) s = "0" + s;
    if (ms < 100) ms = "0" + ms;
    else if (ms < 10) ms = "00" + ms;
    return `${h}:${mi}:${s}${includeMs ? `.${ms}` : ""}`;
  } catch (e) {
    return "?";
  }
}
