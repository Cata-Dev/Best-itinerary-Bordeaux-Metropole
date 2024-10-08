/* eslint-disable prefer-rest-params */
import { makeLogger } from "common/lib/logger";
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
