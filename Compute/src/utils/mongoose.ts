import { createConnection } from "mongoose";
import type { Application, BaseApplication } from "../base";

export async function initDB(app: BaseApplication, db: Application["config"]["sourceDataDB" | "mainDB"]) {
  const connection = createConnection(
    app.config.dbAddress + db,
    //{ useNewUrlParser: true }
  );

  await connection.asPromise();

  app.logger.log(`Database ${connection.db?.databaseName ?? "UNKNOWN"} connected.`);

  return connection;
}
