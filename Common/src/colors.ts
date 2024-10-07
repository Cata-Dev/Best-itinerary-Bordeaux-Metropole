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
export const colorFunctions: colorFunctions = (Object.keys(colors) as Colors[]).reduce((acc: Partial<colorFunctions>, k: Colors) => {
  return {
    ...acc,
    [k]: (s: string | number) =>
      // eslint-disable-next-line no-control-regex
      `${colors[k]}${s.toString().replace(/(\\x1b|)\[0m/g, "")}\x1b[0m`,
  };
}, {}) as colorFunctions;
