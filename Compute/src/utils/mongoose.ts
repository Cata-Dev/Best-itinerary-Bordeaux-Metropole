import { createConnection } from "mongoose";
import type { Application } from "../base";

export async function initDB(app: Application, db: Application["config"]["sourceDataDB" | "mainDB"]) {
  const connection = createConnection(
    app.config.dbAddress + db,
    //{ useNewUrlParser: true }
  );

  await connection.asPromise();

  console.info(`Database ${connection.db.databaseName} connected.`);

  return connection;
}
