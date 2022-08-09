import { itinerary } from "./itinerary/itinerary.service";
import { refreshData } from "./refresh-data/refresh-data.service";
import { geocode } from "./geocode/geocode.service";
import type { Application } from "../declarations";

export const services = (app: Application) => {
  app.configure(itinerary);
  app.configure(refreshData);
  app.configure(geocode);
  // All services will be registered here
};
