import { connect } from "@bibm/data/utils/db";
import type { Application, BaseApplication } from "../base";

const initDB = (app: BaseApplication, dbName: Application["config"]["sourceDB" | "computeDB"]) =>
  connect(app.logger, app.config.dbAddress, dbName);

export { initDB };
