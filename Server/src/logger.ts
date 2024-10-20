import { makeLogger } from "common/logger";
import type { HookContext, NextFunction } from "./declarations";

export const logger = makeLogger();

export const logErrorHook = async (_: HookContext, next: NextFunction) => {
  try {
    await next();
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
