/**
 * @param ms Une durée en secondes
 * @param includeSec Un booléen indiquant s'il faut inclure les secondes
 * @returns La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
 */
function duration(ms: number, includeSec = true, short = false): string {
  ms = Math.sqrt(ms ** 2); //ensure positive value

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
  }${d > 0 ? `${d}${short ? "j" : ` jour${sd}`} ` : ""}${h > 0 ? `${h}${short ? "h" : ` heure${sh}`} ` : ""}${
    mi > 0 ? `${mi}${short ? ` min${smi}` : ` minute${smi}`} ` : ""
  }${s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`} ` : ""}`.replace(/ $/g, "");
}

/**
 * @returns {string} Une date au format "DD/MoMo, HH:MiMi"
 */
function formatDate(date: string | number | Date, hourOnly = false): string {
  if (!(date instanceof Date)) date = new Date(date);
  if (!date) return "?";
  const h = date.getHours() < 10 ? "0" + date.getHours() : date.getHours().toString();
  const mi = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes().toString();
  if (!hourOnly) {
    const d = date.getDate() < 10 ? "0" + date.getDate() : date.getDate().toString();
    const mo = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1).toString();
    return `${d}/${mo}, ${h}:${mi}`;
  }
  return `${h}:${mi}`;
}

export type UnknowIcon = "question-circle";
export type TransportIcon = "walking" | "bus" | "train" | "ship" | "subway";

const icons: Record<TransportMode | UnknowLitteral, TransportIcon | UnknowIcon> = {
  FOOT: "walking",
  BUS: "bus",
  TRAM: "train",
  BATEAU: "ship",
  TRAIN: "subway",
  UNKNOW: "question-circle",
};

/**
 * @param {String} transport
 * @returns {String}
 */
function transportToIcon(transport: string): string {
  transport = transport.toUpperCase();
  return transport in icons ? icons[transport as keyof typeof icons] : icons["UNKNOW"];
}

export type UnknowLitteral = "UNKNOW";
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
  return transport in transports ? transports[transport as keyof typeof transports] : "unknow";
}

/**
 * Properly compare 2 objects.
 */
function equalObjects(
  o1: Record<string, unknown> | unknown,
  o2: Record<string, unknown> | unknown,
): boolean | null {
  if (o1 == undefined || typeof o1 !== "object" || o2 == undefined || typeof o2 !== "object")
    return o1 === o2;

  const keys = Object.keys(o1 as object);
  keys.push(...Object.keys(o2 as object).filter((k) => !keys.find((kk) => kk === k)));
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

    if (
      typeof target[k] === "object" &&
      target[k] !== null &&
      typeof base[k] === "object" &&
      base[k] !== null
    )
      return rebaseObject(target[k], base[k]);

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
  value: function () {
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

export {
  duration,
  formatDate,
  transportToIcon,
  transportToType,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  parseJSON,
  getNewTopZIndex,
};
export type { Obj };
