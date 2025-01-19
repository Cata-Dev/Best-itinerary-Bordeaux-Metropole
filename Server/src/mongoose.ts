import { connect } from "@bibm/data/utils/db";
import { Connection } from "mongoose";
import { HookContext, NextFunction } from "./declarations";
import { logger } from "./logger";

declare module "./declarations" {
  interface Configuration {
    sourceDBConn: Connection;
    computeDBConn: Connection;
  }
}

export async function setupMongoose(context: HookContext, next: NextFunction) {
  context.app.set(
    "sourceDBConn",
    await connect(logger, context.app.get("dbAddress"), context.app.get("sourceDB")),
  );
  context.app.set(
    "computeDBConn",
    await connect(logger, context.app.get("dbAddress"), context.app.get("computeDB")),
  );

  logger.info("Database connected.");

  await next();
}

export async function teardownMongoose(context: HookContext, next: NextFunction) {
  await context.app.get("sourceDBConn").close();
  await context.app.get("computeDBConn").close();

  logger.info("Database disconnected.");

  await next();
}
