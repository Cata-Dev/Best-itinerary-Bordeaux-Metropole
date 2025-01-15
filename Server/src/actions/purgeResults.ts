import { Logger } from "common/logger";
import { connect } from "data/utils/db";
import { parentPort } from "node:worker_threads";
import { logger as baseLogger } from ".";
import { config } from "data/config/index";
import resultModelInit from "data/models/Compute/result.model";
import { singleUseWorker } from "common/workers";

const logger = new Logger(baseLogger, "[purgeResults]");

if (parentPort) {
  (async () => {
    const computeDB = await connect(logger, config.dbAddress, config.computeDB);
    const resultModel = resultModelInit(computeDB);

    const { deletedCount } = await resultModel.deleteMany({
      createdAt: {
        $lte:
          // 2 days from now
          new Date(Date.now() - 2 * 24 * 3_600 * 1_000),
      },
    });

    await computeDB.close();

    logger.info(`Deleted ${deletedCount} old results.`);

    parentPort.postMessage(undefined satisfies ReturnType<purgeResults>);
  })().catch((err) => logger.warn(err));
}

export type purgeResults = () => void;
export default function register() {
  const exec = () => singleUseWorker<purgeResults>(__filename).catch((err) => logger.warn(err)) as unknown;
  setInterval(exec, 24 * 3_600 * 1_000);
  exec();
}
