export type resolveCb<T = void> = (value: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type rejectCb = (reason?: any) => void;
export class Deferred<T = unknown> {
  public promise: Promise<T>;
  public resolve!: resolveCb<T>;
  public reject!: rejectCb;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

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
 * @description Wrap a map of promises into one promise
 */
export async function mapAsync<I, O>(
  array: I[],
  callback: (value: I, index: number, array: I[]) => Promise<O>,
): Promise<O[]> {
  return await Promise.all(array.map(callback));
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

export const time = {
  sToTime: (sec: number | string) => {
    if (typeof sec != "number") sec = Number(sec);

    let hours: number | string = sec / 3600 >= 1 ? Math.floor(sec / 3600) : 0;
    let mins: number | string = Math.floor((sec % 3600) / 60);
    sec = ((sec % 3600) % 60) % 60;

    if (hours < 10 && hours > 0) hours = "0" + String(hours);
    if (mins < 10) mins = "0" + String(mins);
    if (sec < 10) sec = "0" + String(sec);

    return hours != 0 ? hours + ":" + mins + ":" + sec : mins + ":" + sec;
  },

  /**
   * @description Converts milliseconds to duration formatted as MM:SS
   * @param {Number} ms Les millisecondes à convertir
   * @returns {String} Duration formatted as MM:SS
   */
  msToTime: (ms: number): string => {
    if (typeof ms != "number") ms = Number(ms);

    const date = new Date(ms);
    let m: number | string = date.getMinutes();
    let s: number | string = date.getSeconds();
    if (m < 10) m = "0" + m;
    if (s < 10) s = "0" + s;

    return `${m}:${s}`;
  },

  /**
   * @returns {string} Une date au format "JJ mois année à HH:MM:SS"
   */
  timeConverter: (date: Date | number): string => {
    if (!(date instanceof Date)) date = new Date(date);
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    const year = date.getFullYear();
    const month = months[date.getMonth()];
    const d = date.getDate();
    let hour: number | string = date.getHours();
    if (hour < 10) hour = "0" + hour;
    let min: number | string = date.getMinutes();
    if (min < 10) min = "0" + min;
    let sec: number | string = date.getSeconds();
    if (sec < 10) sec = "0" + sec;
    return d + " " + month + " " + year + " à " + hour + ":" + min + ":" + sec;
  },

  /**
   * @returns {string} Une date au format "DD/MoMo/YY, HH:MiMi:SS"
   */
  datetocompact: (date: Date | number): string => {
    if (!(date instanceof Date)) date = new Date(date);
    try {
      let d: number | string = date.getDate();
      let mo: number | string = date.getMonth() + 1;
      let y: number | string = parseInt(date.getFullYear().toString().substring(2, 4));
      let h: number | string = date.getHours();
      let mi: number | string = date.getMinutes();
      let s: number | string = date.getSeconds();

      if (d < 10) d = "0" + d;
      if (mo < 10) mo = "0" + mo;
      if (y < 10) y = "0" + y;
      if (h < 10) h = "0" + h;
      if (mi < 10) mi = "0" + mi;
      if (s < 10) s = "0" + s;
      return d + "/" + mo + "/" + y + ", " + h + ":" + mi + ":" + s;
    } catch (_) {
      return "?";
    }
  },

  /**
   * @returns {string} Une date au format "DD/MoMo, HH:MiMi"
   */
  datetocompact1: (date: Date | number): string => {
    if (!(date instanceof Date)) date = new Date(date);
    try {
      let d: number | string = date.getDate();
      let mo: number | string = date.getMonth() + 1;
      let h: number | string = date.getHours();
      let mi: number | string = date.getMinutes();

      if (d < 10) d = "0" + d;
      if (mo < 10) mo = "0" + mo;
      if (h < 10) h = "0" + h;
      if (mi < 10) mi = "0" + mi;
      return d + "/" + mo + ", " + h + ":" + mi;
    } catch (e) {
      return "?";
    }
  },

  /**
   * @returns {string} Une date au format "DD/MM/YYYY"
   */
  datetocompact2: (date: Date | number): string => {
    if (!(date instanceof Date)) date = new Date(date);
    try {
      let d: number | string = date.getDate();
      let mo: number | string = date.getMonth() + 1;
      let y: number | string = parseInt(date.getFullYear().toString());

      if (d < 10) d = "0" + d;
      if (mo < 10) mo = "0" + mo;
      if (y < 10) y = "0" + y;
      return d + "/" + mo + "/" + y;
    } catch (e) {
      return "?";
    }
  },

  /**
   * @param {Date} date
   * @param {boolean} includeMs Un booléen indiquant s'il faut inclure les millisecondes
   * @returns {string} Une date au format "HH:MiMi:SS"
   */
  datetocompact3: (date: Date | number, includeMs: boolean): string => {
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
  },

  /**
   * @param ms A duration in seconds
   * @param includeSec Whether to include seconds or not, default to true
   * @returns Formatted duration (YY?, MoMo?, DD?, HH?, MiMi?, SS?)
   */
  duration: (ms: number, includeSec = true, short = false) => {
    ms = Math.sqrt(ms ** 2);

    const y = Math.floor(ms / 31556952000);
    ms -= y * 31556952000;
    const sy = y > 1 ? "s" : "";

    const mo = Math.floor(ms / 2629746000);
    ms -= mo * 2629746000;

    const d = Math.floor(ms / (3600000 * 24));
    ms -= d * 3600000 * 24;
    const sd = d > 1 ? "s" : "";

    const h = Math.floor(ms / 3600000);
    ms -= h * 3600000;
    const sh = h > 1 ? "s" : "";

    const mi = Math.floor(ms / 60000);
    ms -= mi * 60000;
    const smi = mi > 1 ? "s" : "";

    const s = Math.round(ms / 1000);
    const ss = s > 1 ? "s" : "";

    return `${y > 0 && y < Infinity ? `${y}${short ? "a" : ` an${sy}`} ` : ""}${
      mo > 0 ? `${mo}${short ? "mo" : ` mois`} ` : ""
    }${d > 0 ? `${d}${short ? "j" : ` jour${sd}`} ` : ""}${
      h > 0 ? `${h}${short ? "h" : ` heure${sh}`} ` : ""
    }${mi > 0 ? `${mi}${short ? "m" : ` minute${smi}`} ` : ""}${
      s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`} ` : ""
    }`.replace(/ $/g, "");
  },
};

/**
 * Permet de mettre en pause l'exécution du code pour un délai donné, dans du code asynchrone
 * @param {number} [ms=1000] Nombre de millisecondes à attendre, 1s par défaut
 * @returns {Promise} Une promesse à await
 * @example await wait(1000) //permet de pause l'exécution pendant 1s
 */
export function wait(ms = 1000): Promise<void> {
  const defP = new Deferred<void>();

  setTimeout(() => {
    defP.resolve();
  }, ms);

  return defP.promise;
}

/**
 * Meilleur round, prend en compte les décimales
 * @param {number} number Le nombre à arrondir
 * @returns {string}
 */
export const round = (number: number): string => {
  if (typeof number !== "number") number = Number(number);
  let retenues = 0;
  let decs;
  const decimals = Math.round(Number(number.toFixed(3).toString().split(".")[1]) / 10);
  if (decimals >= 100) {
    retenues++;
    decs = "";
  } else if (decimals == 0) {
    decs = "";
  } else {
    decs = "." + decimals.toString();
  }
  const integers = String(Math.floor(number) + retenues);
  return integers + decs;
};

/**
 * Coloration methods
 */
const colors = {
  fBlack: "\x1b[30m",
  fR: "\x1b[31m",
  fG: "\x1b[32m",
  fY: "\x1b[33m",
  fB: "\x1b[34m",
  fM: "\x1b[35m",
  fC: "\x1b[36m",
  fW: "\x1b[37m",
  bBlack: "\x1b[40m",
  bR: "\x1b[41m",
  bG: "\x1b[42m",
  bY: "\x1b[43m",
  bB: "\x1b[44m",
  bM: "\x1b[45m",
  bC: "\x1b[46m",
  bW: "\x1b[47m",
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
};
type Colors = keyof typeof colors;
type colorFunctions = Record<Colors, (s: string | number) => string>;
export const colorFunctions: colorFunctions = (Object.keys(colors) as Colors[]).reduce(
  (acc: Partial<colorFunctions>, k: Colors) => {
    return {
      ...acc,
      [k]: (s: string | number) =>
        // eslint-disable-next-line no-control-regex
        `${colors[k]}${s.toString().replace(/(\\x1b|)\[0m/g, "")}\x1b[0m`,
    };
  },
  {},
) as colorFunctions;

/**
 * @description Checks unicity of a value in an array
 */
export function unique<T>(v: T, i: number, arr: T[]): boolean {
  return arr.indexOf(v) === i;
}
