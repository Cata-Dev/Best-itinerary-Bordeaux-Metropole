import { createConnection, Connection } from "mongoose";
import { HookContext, NextFunction } from "./declarations";
import { logger } from "./logger";

export async function setupMongoose(context: HookContext, next: NextFunction) {
  const connection = await createConnection(context.app.get("mongodb")).asPromise();
  logger.info("Database connected.");
  context.app.set("mongooseClient", connection);
  await next();
}

export async function teardownMongoose(context: HookContext, next: NextFunction) {
  await context.app.get("mongooseClient").close();
  logger.info("Database disconnected.");
  await next();
}

declare module "./declarations" {
  interface Configuration {
    mongooseClient: Connection;
  }
}
