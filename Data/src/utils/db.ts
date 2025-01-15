import { memoize } from "common/cache";
import { makeLogger } from "common/logger";
import { createConnection } from "mongoose";

const connect = memoize(async function (
  remove,
  logger: ReturnType<typeof makeLogger>,
  dbAddress: string,
  dbName: string,
) {
  const connection = createConnection(
    dbAddress + dbName,
    //{ useNewUrlParser: true }
  );

  await connection.asPromise();
  connection.once("close", () => remove());

  logger.log(`Database ${connection.db?.databaseName ?? "UNKNOWN"} connected.`);

  return connection;
});

export { connect };
