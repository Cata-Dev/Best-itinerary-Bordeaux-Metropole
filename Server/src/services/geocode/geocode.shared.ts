// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from "@feathersjs/feathers";
import type { ClientApplication } from "../../client";
import type { Geocode, GeocodeData, GeocodePatch, GeocodeQuery, GeocodeService } from "./geocode.class";

export type { Geocode, GeocodeData, GeocodePatch, GeocodeQuery };

export type GeocodeClientService = Pick<
  GeocodeService<Params<GeocodeQuery>>,
  (typeof geocodeMethods)[number]
>;

export const geocodePath = "geocode";

export const geocodeMethods = ["find", "get"] as const;

export const geocodeClient = (client: ClientApplication) => {
  const connection = client.get("connection");

  client.use(geocodePath, connection.service(geocodePath), {
    methods: geocodeMethods,
  });
};

// Add this service to the client service type index
declare module "../../client" {
  interface ServiceTypes {
    [geocodePath]: GeocodeClientService;
  }
}
