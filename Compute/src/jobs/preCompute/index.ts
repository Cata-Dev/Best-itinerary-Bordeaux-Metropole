import { Logger } from "common/logger";
import { app } from "../../base";

export const preComputeLogger = new Logger(app.logger, "[preCompute]");
