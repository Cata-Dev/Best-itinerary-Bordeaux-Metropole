import { createConnection } from "mongoose";
import type { Application, BaseApplication } from "../base";
import { memoize } from "common/memoize";

const initDB = memoize(async function (
  app: BaseApplication,
  db: Application["config"]["sourceDB" | "computeDB"],
) {
  const connection = createConnection(
    app.config.dbAddress + db,
    //{ useNewUrlParser: true }
  );

  await connection.asPromise();

  app.logger.log(`Database ${connection.db?.databaseName ?? "UNKNOWN"} connected.`);

  return connection;
});

export { initDB };
