import { Agenda as OriginalAgenda } from "@hokify/agenda";
import { makeLogger } from "common/lib/logger";
import type { Agenda } from "./agendaCustom";
import config from "../config.json";

export interface Config {
  dbAddress: string;
  sourceDataDB: string;
  mainDB: string;
}

export interface Application {
  readonly agenda: Agenda;
  readonly config: Config;
  /**
   * Feel free to override it with a custom logger (prefixes)
   */
  logger: ReturnType<typeof makeLogger>;
}

const logger = makeLogger();

const agenda = new OriginalAgenda({
  db: {
    address: (config satisfies Config).dbAddress + (config satisfies Config).mainDB,
  },
  lockLimit: 100,
  processEvery: 2_000,
});

export const app: Application = {
  agenda,
  config,
  logger,
};

agenda.once("ready", () => app.logger.log("Agenda instance ready"));

export function askShutdown() {
  return new Promise<string>((res, rej) => {
    app.agenda
      .stop()
      .then(() => {
        res("Agenda instance stopped");
      })
      .catch(rej);
  });
}
