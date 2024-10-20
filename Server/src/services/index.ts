import { itinerary } from "./itinerary/itinerary";
import { refreshData } from "./refresh-data/refresh-data";
import { geocode } from "./geocode/geocode";
import type { Application } from "../declarations";

export const services = (app: Application) => {
  app.configure(geocode);
  app.configure(refreshData);
  app.configure(itinerary);
  // All services will be registered here
};
