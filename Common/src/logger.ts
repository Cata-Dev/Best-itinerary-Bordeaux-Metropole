/* eslint-disable prefer-rest-params */
import { format } from "util";
import { colorFunctions } from "./colors";

const prefix = (prefixes: string[]) => [`[${new Date().toLocaleString("fr-FR")}]`].concat(prefixes).join(" ");
const formatArgs = (args: IArguments) => format.apply(format, Array.prototype.slice.call(args));

export const makeLogger = (...prefixes: string[]): Record<"log" | "info" | "warn" | "error" | "debug", typeof console.log> => ({
  log: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(prefixes)].concat(args).join(" ")}`;
    console.log(str);
  },

  info: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(prefixes), "ℹ️"].concat(args).join(" ")}`;
    console.log(colorFunctions.bright(colorFunctions.fG(str)));
  },

  warn: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(prefixes), "⚠️"].concat(args).join(" ")}`;
    console.log(colorFunctions.bY(colorFunctions.bright(colorFunctions.fW(str))));
  },

  error: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(prefixes), "❌"].concat(args).join(" ")}`;
    console.log(colorFunctions.bR(colorFunctions.bright(colorFunctions.fW(str))));
  },

  debug: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(prefixes), "{🐛 DEBUG}"].concat(args).join(" ")}`;
    console.log(colorFunctions.bBlack(colorFunctions.bright(colorFunctions.fY(str))));
  },
});
