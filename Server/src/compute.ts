import { main } from "compute/lib/main";
import { HookContext, NextFunction } from "./declarations";
import { logger } from "./logger";
import { cpus } from "node:os";

declare module "./declarations" {
  interface Configuration {
    compute: Awaited<ReturnType<typeof main>>;
  }
}

export async function setupCompute(context: HookContext, next: NextFunction) {
  const compute = await main(cpus().length);
  logger.info("Compute manager ready.");

  context.app.set("compute", compute);

  await next();
}

export async function teardownCompute(context: HookContext, next: NextFunction) {
  try {
    await context.app.get("compute").gracefulStop();
    logger.info("Compute manager shutdown finished");
  } catch (err) {
    logger.error("Error during compute manager shutdown", err);
  }
  await next();
}
