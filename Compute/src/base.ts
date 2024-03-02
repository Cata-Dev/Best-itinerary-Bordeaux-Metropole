import { Agenda as OriginalAgenda } from "@hokify/agenda";
import type { Agenda } from "./agendaCustom";
import config from "../config.json";

export interface Config {
  dbAddress: string;
  sourceDataDB: string;
  mainDB: string;
}

export interface Application {
  agenda: Agenda;
  config: Config;
}

const agenda = new OriginalAgenda({
  db: {
    address: (config satisfies Config).dbAddress + (config satisfies Config).mainDB,
  },
  lockLimit: 100,
  processEvery: 2_000,
});
agenda.once("ready", () => console.log("Agenda instance ready"));

export const app: Application = {
  agenda,
  config,
};

export const gracefulStop = () => {
  app.agenda
    .stop()
    .catch(console.error)
    .finally(() => {
      console.log("Agenda instance stopped");
      process.exit(0);
    });
};
