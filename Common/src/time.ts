/**
 * Format a time duration
 * @param ms A duration in seconds
 * @param includeSec Whether to include seconds or not, default to true
 * @returns Formatted duration (YY?, MoMo?, DD?, HH?, MiMi?, SS?)
 */
function duration(ms: number, includeSec = true, short = false) {
  ms = Math.sqrt(ms ** 2);

  if (ms >= Infinity) return "∞";

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
  }${mi > 0 ? `${mi}${short ? "m" : ` minute${smi}`} ` : ""}${s > 0 && includeSec ? `${s}${short ? "s" : ` seconde${ss}`} ` : ""}`.replace(
    / $/g,
    "",
  );
}

export { duration };
