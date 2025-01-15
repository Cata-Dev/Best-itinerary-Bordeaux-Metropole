import { Logger } from "common/logger";
import type { HookContext, NextFunction } from "./declarations";

export const logger = new Logger("[SERVER]");

export const logErrorHook = async (_: HookContext, next: NextFunction) => {
  try {
    await next();
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
