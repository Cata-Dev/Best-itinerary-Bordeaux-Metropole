import { Logger } from "@bibm/common/logger";
import { app } from "../../base";

export const preComputeLogger = new Logger(app.logger, "[preCompute]");
