import type { Application } from "../declarations";
import { geocode } from "./geocode/geocode";
import { journey } from "./journey/journey";
import { path } from "./path/path";
import { refreshData } from "./refresh-data/refresh-data";

export const services = (app: Application) => {
  app.configure(geocode);
  app.configure(refreshData);
  app.configure(journey);
  app.configure(path);
  // All services will be registered here
};
