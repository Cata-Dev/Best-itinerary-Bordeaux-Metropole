import { format } from "util";
import { colorFunctions } from "./colors";

class Logger {
  private readonly prefix: string;

  constructor(...prefixes: string[]);
  constructor(logger: Logger, ...prefixes: string[]);
  constructor(loggerOrPrefix: Logger | string, ...prefixes: string[]) {
    if (loggerOrPrefix instanceof Logger)
      this.prefix = [loggerOrPrefix.prefix]
        .concat(...prefixes)
        .join(" ")
        .trim();
    else this.prefix = [loggerOrPrefix].concat(prefixes).join(" ").trim();
  }

  static formatArgs(...args: unknown[]) {
    return format.apply(format, Array.prototype.slice.call(args));
  }

  private get datedPrefix() {
    return `[${new Date().toLocaleString("fr-FR")}] ${this.prefix}`.trimEnd();
  }

  log(...args: unknown[]) {
    console.log(this.datedPrefix, Logger.formatArgs(...args));
  }

  info(...args: unknown[]) {
    console.log(
      colorFunctions.bright(
        colorFunctions.fG(`${[this.datedPrefix, "ℹ️"].concat(Logger.formatArgs(...args)).join(" ")}`),
      ),
    );
  }

  warn(...args: unknown[]) {
    console.log(
      colorFunctions.bY(
        colorFunctions.bright(
          colorFunctions.fW(`${[this.datedPrefix, "⚠️"].concat(Logger.formatArgs(...args)).join(" ")}`),
        ),
      ),
    );
  }

  error(...args: unknown[]) {
    console.log(
      colorFunctions.bR(
        colorFunctions.bright(
          colorFunctions.fW(`${[this.datedPrefix, "❌"].concat(Logger.formatArgs(...args)).join(" ")}`),
        ),
      ),
    );
  }

  debug(...args: unknown[]) {
    console.log(
      colorFunctions.bBlack(
        colorFunctions.bright(
          colorFunctions.fY(`${[this.datedPrefix, "🐛"].concat(Logger.formatArgs(...args)).join(" ")}`),
        ),
      ),
    );
  }
}

export { Logger };
