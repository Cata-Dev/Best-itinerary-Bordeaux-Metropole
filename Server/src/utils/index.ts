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

const X0 = 700000;
const Y0 = 6600000;
const a = 6378137;
const e = 0.08181919106;
const l0 = (Math.PI / 180) * 3;
const lc = l0;
const phi0 = (Math.PI / 180) * 46.5;
const phi1 = (Math.PI / 180) * 44;
const phi2 = (Math.PI / 180) * 49;

const gN1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
const gN2 = a / Math.sqrt(1 - e * e * Math.sin(phi2) * Math.sin(phi2));

const gl0 = Math.log(
  Math.tan(Math.PI / 4 + phi0 / 2) * Math.pow((1 - e * Math.sin(phi0)) / (1 + e * Math.sin(phi0)), e / 2),
);
const gl1 = Math.log(
  Math.tan(Math.PI / 4 + phi1 / 2) * Math.pow((1 - e * Math.sin(phi1)) / (1 + e * Math.sin(phi1)), e / 2),
);
const gl2 = Math.log(
  Math.tan(Math.PI / 4 + phi2 / 2) * Math.pow((1 - e * Math.sin(phi2)) / (1 + e * Math.sin(phi2)), e / 2),
);

const n = Math.log((gN2 * Math.cos(phi2)) / (gN1 * Math.cos(phi1))) / (gl1 - gl2);
const c = ((gN1 * Math.cos(phi1)) / n) * Math.exp(n * gl1);

/**
 * @description Converts WGS coordinates into Lambert 93 coordinates
 */
export const WGSToLambert93 = (lat: number, long: number): [number, number] => {
  const phi = (Math.PI / 180) * lat;
  const l = (Math.PI / 180) * long;

  const gl = Math.log(
    Math.tan(Math.PI / 4 + phi / 2) * Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2),
  );

  const ys = Y0 + c * Math.exp(-1 * n * gl0);

  return [
    X0 + c * Math.exp(-1 * n * gl) * Math.sin(n * (l - lc)),
    ys - c * Math.exp(-1 * n * gl) * Math.cos(n * (l - lc)),
  ];
};

export const degToRad = (deg: number) => {
  return (deg * Math.PI) / 180;
};

/**
 * @description Get the distance between two geographic coordinates.
 * @param {Number} lon1
 * @param {Number} lat1
 * @param {Number} lon2
 * @param {Number} lat2
 * @returns {Number} The distance in meters.
 */
export const geographicDistance = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
  const earthRadiusKm = 6371;

  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  lat1 = degToRad(lat1);
  lat2 = degToRad(lat2);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 1000;
};

/**
 * @description Get the distance between two cartographic coordinates.
 * @returns {Number} The distance in meters.
 */
export const cartographicDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

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
