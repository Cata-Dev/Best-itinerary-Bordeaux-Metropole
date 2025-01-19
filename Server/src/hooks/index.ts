import { colorFunctions } from "@bibm/common/colors";
import { GeneralError } from "@feathersjs/errors";
import { performance } from "perf_hooks";
import { HookContext, NextFunction } from "../declarations";
import { logger } from "../logger";
import { compactDate } from "../utils";

const log = async (context: HookContext, next: NextFunction) => {
  const initialTs = performance.now();

  try {
    await next();

    logger.log(
      `${compactDate(performance.timeOrigin + initialTs, true)} ⟾ ${compactDate(
        Date.now(),
        true,
      )} (${(performance.now() - initialTs).toFixed(2)}ms) | ${colorFunctions.fB(
        `${context.http?.status ?? "200"} ${context.method.toUpperCase()}`,
      )} ${context.path}${context.id ? "/" + colorFunctions.fY(context.id) : ""} (provider: ${
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        context.params?.provider || "internal"
      })`,
    );
  } catch (error) {
    logger.log(
      `${compactDate(performance.timeOrigin + initialTs, true)} ⟾ ${compactDate(
        Date.now(),
        true,
      )} (${(performance.now() - initialTs).toFixed(2)}ms) | ${colorFunctions.fR(
        `${(context.http?.status ?? ("code" in (error as object) && (error as { code: number }).code)) || "500"} ${context.method.toUpperCase()}`,
      )} ${context.path}${context.id ? "/" + colorFunctions.fY(context.id) : ""} (provider: ${
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        context.params?.provider || "internal"
      })`,
    );
  }
};

function isError(e: unknown): e is { code?: number; stack?: unknown } {
  return typeof e === "object" && e !== null && ("code" in e || "stack" in e);
}

const errorHandler = (context: HookContext) => {
  if (isError(context.error)) {
    const error = context.error;

    if (!error.code) {
      context.error = new GeneralError("Server error");
    }

    if (error.code === 404 || process.env.NODE_ENV === "production") {
      error.stack = null;
    }
  }
};

export { errorHandler, log };
