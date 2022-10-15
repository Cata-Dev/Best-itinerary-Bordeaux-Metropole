import { app } from "./app";
import { logger } from "./logger";

const port = app.get("port");
const host = app.get("host");

process.on("unhandledRejection", (reason, p) => console.error("Unhandled Rejection at: Promise ", p, reason));

import fs from "fs";
import https from "https";

const ssl = !!app.get("ssl").key;

if (ssl) {
  const opts = {
    key: fs.readFileSync(app.get("ssl").key),
    cert: fs.readFileSync(app.get("ssl").cert),
  };

  const server = https.createServer(opts, app as never).listen(port);
  app.setup(server);
  server.on("listening", () => logger.info(`Feathers application started on http://${host}:${port}`));
} else {
  app.listen(port).then(() => {
    logger.info(`Feathers application started on http://${host}:${port}`);
  });
}
