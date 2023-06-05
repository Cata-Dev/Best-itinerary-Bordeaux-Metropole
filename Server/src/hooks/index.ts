import errors from "@feathersjs/errors";
import { performance } from "perf_hooks";
import { HookContext, NextFunction } from "../declarations";
import { logger } from "../logger";
import { time, colorFunctions } from "../utils";

const log = async (context: HookContext, next: NextFunction) => {
  const initialTs = performance.now();

  try {
    await next();

    logger.log(
      `${time.datetocompact3(performance.timeOrigin + initialTs, true)} ⟾ ${time.datetocompact3(
        Date.now(),
        true,
      )} (${(performance.now() - initialTs).toFixed(2)}ms) | ${colorFunctions.fB(
        `${context.http?.status || "200"} ${context.method.toUpperCase()}`,
      )} ${context.path}${context.id ? "/" + colorFunctions.fY(context.id) : ""} (provider: ${
        context.params?.provider || "internal"
      })`,
    );
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  } catch (error: any) {
    logger.log(
      `${time.datetocompact3(performance.timeOrigin + initialTs, true)} ⟾ ${time.datetocompact3(
        Date.now(),
        true,
      )} (${(performance.now() - initialTs).toFixed(2)}ms) | ${colorFunctions.fR(
        `${context.http?.status || error?.code || "500"} ${context.method.toUpperCase()}`,
      )} ${context.path}${context.id ? "/" + colorFunctions.fY(context.id) : ""} (provider: ${
        context.params?.provider || "internal"
      })`,
    );
  }
};

const errorHandler = async (context: HookContext) => {
  if (context.error) {
    const error = context.error;
    if (!error.code) {
      const newError = new errors.GeneralError("server error");
      context.error = newError;
    }
    if (error.code === 404 || process.env.NODE_ENV === "production") {
      error.stack = null;
    }
  }
};

export { log, errorHandler };
