import { createConnection, Connection } from "mongoose";
import { HookContext, NextFunction } from "./declarations";
import { logger } from "./logger";

declare module "./declarations" {
  interface Configuration {
    sourceDBConn: Connection;
    computeDBConn: Connection;
  }
}

export async function setupMongoose(context: HookContext, next: NextFunction) {
  const sourceDBConn = await createConnection(
    context.app.get("dbAddress") + context.app.get("sourceDB"),
  ).asPromise();
  const computeDBConn = await createConnection(
    context.app.get("dbAddress") + context.app.get("computeDB"),
  ).asPromise();

  logger.info("Database connected.");

  context.app.set("sourceDBConn", sourceDBConn);
  context.app.set("computeDBConn", computeDBConn);

  await next();
}

export async function teardownMongoose(context: HookContext, next: NextFunction) {
  await context.app.get("sourceDBConn").close();
  await context.app.get("computeDBConn").close();

  logger.info("Database disconnected.");

  await next();
}
