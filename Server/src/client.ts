import { feathers } from "@feathersjs/feathers";
import type { ItineraryData, ItineraryResult, ItineraryQuery } from "./services/itinerary/itinerary.schema";
import type { GeocodeData, GeocodeResult, GeocodeQuery } from "./services/geocode/geocode.schema";
import type { Service, TransportConnection, Params } from "@feathersjs/feathers";

export interface ServiceTypes {
  itinerary: Service<ItineraryData, ItineraryResult, Params<ItineraryQuery>>;
  geocode: Service<GeocodeData, GeocodeResult, Params<GeocodeQuery>>;
  // A mapping of client side services
}

export const createClient = <Configuration = unknown>(connection: TransportConnection<ServiceTypes>) => {
  const client = feathers<ServiceTypes, Configuration>();

  client.configure(connection);

  return client;
};
