import { app } from "./app";
import { logger } from "./logger";

const { host, port } = app.get("server");

process.on("unhandledRejection", (reason, p) => logger.error("Unhandled Rejection at: Promise ", p, reason));

void app.listen(port).then(() => {
  logger.info(`Feathers app listening on http://${host}:${port}`);
});
