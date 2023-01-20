import { feathers } from "@feathersjs/feathers";
import type { TransportConnection, Params } from '@feathersjs/feathers'
import authenticationClient from '@feathersjs/authentication-client'
import type { AuthenticationClientOptions } from '@feathersjs/authentication-client'
import type { Itinerary, ItineraryData, ItineraryQuery, ItineraryService } from './services/itinerary/itinerary.js'
export type { Itinerary, ItineraryData, ItineraryQuery }
export const itineraryServiceMethods = ['get'] as const
export type ItineraryClientService = Pick<ItineraryService, (typeof itineraryServiceMethods)[number]>
import type { Geocode, GeocodeData, GeocodeQuery, GeocodeService } from './services/geocode/geocode.js'
export type { Geocode, GeocodeData, GeocodeQuery }
export const geocodeServiceMethods = ['find', 'get'] as const
export type GeocodeClientService = Pick<GeocodeService, (typeof geocodeServiceMethods)[number]>
import type {
  RefreshData,
  RefreshDataData,
  RefreshDataQuery,
  RefreshDataService
} from './services/refresh-data/refresh-data.js'
export type { RefreshData, RefreshDataData, RefreshDataQuery }
export const refreshDataServiceMethods = ['get'] as const
export type RefreshDataClientService = Pick<RefreshDataService, (typeof refreshDataServiceMethods)[number]>


export interface ServiceTypes {
  itinerary: ItineraryClientService;
  geocode: GeocodeClientService;
  "refresh-data": RefreshDataClientService;
  //
}

/**
 * Returns a typed client for the Test feathers app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
export const createClient = <Configuration = unknown,>(
  connection: TransportConnection<ServiceTypes>,
  authenticationOptions: Partial<AuthenticationClientOptions> = {}
) => {
  const client = feathers<ServiceTypes, Configuration>()

  client.configure(connection)
  client.configure(authenticationClient.default(authenticationOptions))

  client.use('itinerary', connection.service('itinerary'), {
    methods: itineraryServiceMethods
  })
  client.use('refresh-data', connection.service('refresh-data'), {
    methods: refreshDataServiceMethods
  })
  client.use('geocode', connection.service('geocode'), {
    methods: geocodeServiceMethods
  })
  return client
}
