import { feathers } from "@feathersjs/feathers";
import type { TransportConnection, Application } from "@feathersjs/feathers";
import authenticationClient from "@feathersjs/authentication-client";
import type { AuthenticationClientOptions } from "@feathersjs/authentication-client";

import { geocodeClient } from "./services/geocode/geocode.shared";
export type { Geocode, GeocodeData, GeocodeQuery, GeocodePatch } from "./services/geocode/geocode.shared";

import { itineraryClient } from "./services/itinerary/itinerary.shared";
export type {
  Itinerary,
  ItineraryData,
  ItineraryQuery,
  ItineraryPatch,
} from "./services/itinerary/itinerary.shared";

import { refreshDataClient } from "./services/refresh-data/refresh-data.shared";
export type {
  RefreshData,
  RefreshDataData,
  RefreshDataQuery,
  RefreshDataPatch,
} from "./services/refresh-data/refresh-data.shared";

export interface Configuration {
  connection: TransportConnection<ServiceTypes>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

export type ClientApplication = Application<ServiceTypes, Configuration>;

/**
 * Returns a typed client for the test app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createClient = <Configuration = unknown>(
  connection: TransportConnection<ServiceTypes>,
  authenticationOptions: Partial<AuthenticationClientOptions> = {},
) => {
  const client: ClientApplication = feathers();

  client.configure(connection);
  client.configure(authenticationClient(authenticationOptions));
  client.set("connection", connection);

  client.configure(geocodeClient);
  client.configure(refreshDataClient);
  client.configure(itineraryClient);
  return client;
};
