import { memoize } from "@bibm/common/cache";
import type { Logger } from "@bibm/common/logger";
import { createConnection } from "mongoose";

const connect = memoize(async function (remove, logger: Logger, dbAddress: string, dbName: string) {
  const connection = createConnection(dbAddress + dbName);

  await connection.asPromise();
  connection.once("close", () => remove());

  logger.log(`Database ${connection.db?.databaseName ?? "UNKNOWN"} connected.`);

  return connection;
});

export { connect };
