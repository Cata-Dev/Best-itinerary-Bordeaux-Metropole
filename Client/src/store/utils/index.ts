/**
 * @returns {string} Une date au format "DD/MoMo, HH:MiMi"
 */
function formatDate(date: string | number | Date, hourOnly = false): string {
  if (!(date instanceof Date)) date = new Date(date);
  const h = date.getHours().toString().padStart(2, "0");
  const mi = date.getMinutes().toString().padStart(2, "0");
  if (!hourOnly) {
    const d = date.getDate().toString().padStart(2, "0");
    const mo = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${d}/${mo}, ${h}:${mi}`;
  }
  return `${h}:${mi}`;
}

/**
 * Format a string interval.
 * Keeps only one bound if they are equal, and factorize the common prefix (delimited by whitespace).
 * @param a First interval bound
 * @param b Second interval bound
 */
function formatInterval(a: string, b: string) {
  const aParts = a.split(" ");
  const bParts = b.split(" ");
  let commonPrefixIdx = -1;
  while (
    ++commonPrefixIdx < Math.min(aParts.length, bParts.length) &&
    aParts[commonPrefixIdx] === bParts[commonPrefixIdx]
  );
  commonPrefixIdx--;

  const commonPrefix = aParts.slice(0, commonPrefixIdx + 1).join(" ") + (commonPrefixIdx > -1 ? " " : "");

  return a === b ? a : `${commonPrefix}[${a.slice(commonPrefix.length)}, ${b.slice(commonPrefix.length)}]`;
}

export type UnknownIcon = "question-circle";
export type TransportIcon = "walking" | "bus" | "train" | "ship" | "subway";

const icons: Record<TransportMode | UnknownLiteral, TransportIcon | UnknownIcon> = {
  FOOT: "walking",
  BUS: "bus",
  TRAM: "train",
  BATEAU: "ship",
  TRAIN: "subway",
  UNKNOWN: "question-circle",
};

/**
 * @param {String} transport
 * @returns {String}
 */
function transportToIcon(transport: string) {
  transport = transport.toUpperCase();
  return transport in icons ? icons[transport as keyof typeof icons] : icons.UNKNOWN;
}

export type UnknownLiteral = "UNKNOWN";
export type TransportMode = "FOOT" | "BUS" | "TRAM" | "BATEAU" | "TRAIN";
export type TransportProvider = "FOOT" | "TBM" | "SNCF";

const transports: Record<TransportMode, TransportProvider> = {
  FOOT: "FOOT",
  BUS: "TBM",
  TRAM: "TBM",
  BATEAU: "TBM",
  TRAIN: "SNCF",
};

function transportToType(transport: string) {
  transport = transport.toUpperCase();
  return transport in transports ? transports[transport as keyof typeof transports] : "unknown";
}

/**
 * Properly compare 2 objects.
 */
function equalObjects(o1: unknown, o2: unknown): boolean | null {
  if (o1 == undefined || typeof o1 !== "object" || o2 == undefined || typeof o2 !== "object")
    return o1 === o2;

  const keys = Object.keys(o1);
  keys.push(...Object.keys(o2).filter((k) => !keys.find((kk) => kk === k)));
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o1, k)) return false;
    if (!Object.prototype.hasOwnProperty.call(o2, k)) return false;
    if (!equalObjects((o1 as Record<string, unknown>)[k], (o2 as Record<string, unknown>)[k])) return false;
  }

  return true;
}

type Obj<T> = { [k: string]: T | Obj<T> } | T;

/**
 * @description In-place object rebasing - recursively
 * @returns A reference to the rebased object
 */
function rebaseObject<V extends string | number | boolean>(target: Obj<V>, base: Obj<V>): Obj<V> {
  if (!(target instanceof Object && base instanceof Object)) return target; // edge condition

  for (const k in base) {
    if (!(k in target)) continue;

    if (typeof target[k] === "object" && typeof base[k] === "object") return rebaseObject(target[k], base[k]);

    if (base[k] != target[k]) target[k] = base[k];
  }

  return target;
}

/**
 * @description In-place object comparison & replacement
 * @returns A reference to the target object
 */
function compareObjectForEach<V extends string | number | boolean>(
  o1: Obj<V>,
  o2: Obj<V>,
  callback: (v1: V, v2: V, keys: string[]) => void,
  keys: string[] = [],
): Obj<V> {
  if (!(o1 instanceof Object && o2 instanceof Object)) return o1; // edge condition

  for (const k in o2) {
    if (!(k in o1)) continue;

    if (o1[k] instanceof Object && o2[k] instanceof Object)
      return compareObjectForEach(o1[k], o2[k], callback, [...keys, k]);

    callback(o1[k] as V, o2[k] as V, [...keys, k]);
  }

  return o1;
}

function formatDateToInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, -1)
    .substring(0, 4 + 1 + 2 + 1 + 2 + 1 + 2 + 1 + 2);
}

function parseJSON(json: string) {
  try {
    return JSON.parse(json);
  } catch (_) {
    return json;
  }
}

function getNewTopZIndex() {
  let max = 0;
  for (const el of document.querySelectorAll("body *")) {
    const zindex = parseInt(window.getComputedStyle(el).zIndex);
    if (zindex > max) max = zindex;
  }
  return max + 1;
}

Object.defineProperty(String.prototype, "capitalize", {
  value: function (this: string) {
    return this.charAt(0).toUpperCase() + this.slice(1);
  },
  enumerable: false,
});

declare global {
  interface String {
    /**
     * @description Capitalize the first letter of the string.
     */
    capitalize(): string;
  }
}

const hasMouse = matchMedia("(pointer:fine)").matches;

export {
  formatDate,
  formatInterval,
  transportToIcon,
  transportToType,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  formatDateToInput,
  parseJSON,
  getNewTopZIndex,
  hasMouse,
};
export type { Obj };
