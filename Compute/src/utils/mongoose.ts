import type { Application, BaseApplication } from "../base";
import { connect } from "data/utils/db";

const initDB = (app: BaseApplication, dbName: Application["config"]["sourceDB" | "computeDB"]) =>
  connect(app.logger, app.config.dbAddress, dbName);

export { initDB };
