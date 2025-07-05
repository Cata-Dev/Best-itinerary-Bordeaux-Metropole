import { Logger } from "@bibm/common/logger";
import { logger as baseLogger } from "../logger";
export const logger = new Logger(baseLogger, "[ACTION]");

import registerPR from "./purgeResults";

const setupActions = () => {
  registerPR();
};

export default setupActions;
