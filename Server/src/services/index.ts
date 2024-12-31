import { journey } from "./journey/journey";
import { refreshData } from "./refresh-data/refresh-data";
import { geocode } from "./geocode/geocode";
import type { Application } from "../declarations";

export const services = (app: Application) => {
  app.configure(geocode);
  app.configure(refreshData);
  app.configure(journey);
  // All services will be registered here
};
