import { main } from "@bibm/compute/main";
import { HookContext, NextFunction } from "./declarations";
import { logger } from "./logger";
import { cpus } from "node:os";

declare module "./declarations" {
  interface Configuration {
    computeInstance: Awaited<ReturnType<typeof main>>;
  }
}

export async function setupCompute(context: HookContext, next: NextFunction) {
  const compute = await main(context.app.get("compute").nbWorkers ?? cpus().length);
  logger.info("Compute manager ready.");

  context.app.set("computeInstance", compute);

  await next();
}

export async function teardownCompute(context: HookContext, next: NextFunction) {
  try {
    await context.app.get("computeInstance").gracefulStop();
    logger.info("Compute manager shutdown finished");
  } catch (err) {
    logger.error("Error during compute manager shutdown", err);
  }
  await next();
}
