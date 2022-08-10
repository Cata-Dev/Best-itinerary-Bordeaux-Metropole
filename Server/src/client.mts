import { feathers } from "@feathersjs/feathers";
import type { TransportConnection } from "@feathersjs/feathers";
import { ItineraryService } from "./services/itinerary/itinerary.class.js";
import { GeocodeService } from "./services/geocode/geocode.class.js";
import { RefreshDataService } from "./services/refresh-data/refresh-data.class.js";

export interface ServiceTypes {
  itinerary: ItineraryService;
  geocode: GeocodeService;
  "refresh-data": RefreshDataService;
  // A mapping of client side services
}

export const createClient = <Configuration = unknown,>(connection: TransportConnection<ServiceTypes>) => {
  const client = feathers<ServiceTypes, Configuration>();

  client.configure(connection);

  return client;
};
