// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from "@feathersjs/feathers";
import type { ClientApplication } from "../../client";
import type {
  Itinerary,
  ItineraryData,
  ItineraryPatch,
  ItineraryQuery,
  ItineraryService,
} from "./itinerary.class";

export type { Itinerary, ItineraryData, ItineraryPatch, ItineraryQuery };

export type ItineraryClientService = Pick<
  ItineraryService<Params<ItineraryQuery>>,
  (typeof itineraryMethods)[number]
>;

export const itineraryPath = "itinerary";

export const itineraryMethods = ["get"] as const;

export const itineraryClient = (client: ClientApplication) => {
  const connection = client.get("connection");

  client.use(itineraryPath, connection.service(itineraryPath), {
    methods: itineraryMethods,
  });
};

// Add this service to the client service type index
declare module "../../client" {
  interface ServiceTypes {
    [itineraryPath]: ItineraryClientService;
  }
}
