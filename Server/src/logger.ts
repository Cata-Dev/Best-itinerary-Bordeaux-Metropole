/* eslint-disable prefer-rest-params */
import { format } from "util";
import type { HookContext, NextFunction } from "./declarations";
import { colorFunctions } from "./utils";

const prefix = () => `[${new Date().toLocaleString("fr-FR")}]`;
const formatArgs = (args: IArguments) => format.apply(format, Array.prototype.slice.call(args));

export const logger: Record<
  "log" | "info" | "warn" | "error" | "debug",
  (message?: unknown, ...optionalParams: unknown[]) => void
> = {
  log: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix()].concat(args).join(" ")}`;
    console.log(str);
  },

  info: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(), "ℹ️"].concat(args).join(" ")}`;
    console.log(colorFunctions.bright(colorFunctions.fG(str)));
  },

  warn: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(), "⚠️"].concat(args).join(" ")}`;
    console.log(colorFunctions.bY(colorFunctions.bright(colorFunctions.fW(str))));
  },

  error: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(), "❌"].concat(args).join(" ")}`;
    console.log(colorFunctions.bR(colorFunctions.bright(colorFunctions.fW(str))));
  },

  debug: function () {
    const args = formatArgs(arguments);
    const str = `${[prefix(), "{🐛 DEBUG}"].concat(args).join(" ")}`;
    console.log(colorFunctions.bBlack(colorFunctions.bright(colorFunctions.fY(str))));
  },
};

export const logErrorHook = async (_: HookContext, next: NextFunction) => {
  try {
    await next();
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
