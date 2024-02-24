// Top exports to avoid double-importing
import { TBMEndpoints } from "../../../../Data/models/TBM/names";
export { TBMEndpoints };

export interface BaseTBM<T extends object = object> {
  properties: T;
}

import axios from "axios";
import { Application } from "../../declarations";
import { Endpoint } from "../endpoint";
import { logger } from "../../logger";

import { dbAddresses, dbAddressesModel } from "../../../../Data/models/TBM/addresses.model";
import addressesEndpoint from "./endpoints/addresses.endpoint";

import { dbIntersections, dbIntersectionsModel } from "../../../../Data/models/TBM/intersections.model";
import intersectionsEndpoint from "./endpoints/intersections.endpoint";

import { dbSections, dbSectionsModel } from "../../../../Data/models/TBM/sections.model";
import sectionsEndpoint from "./endpoints/sections.endpoint";

import { dbTBM_Lines, dbTBM_LinesModel } from "../../../../Data/models/TBM/TBM_lines.model";
import TBM_linesEndpoint from "./endpoints/TBM_lines.endpoint";

import {
  dbTBM_Lines_routes,
  dbTBM_Lines_routesModel,
} from "../../../../Data/models/TBM/TBM_lines_routes.model";
import TBM_lines_routesEndpoint from "./endpoints/TBM_lines_routes.endpoint";

import {
  dbTBM_Schedules,
  dbTBM_SchedulesModel,
  dbTBM_Schedules_rt,
  dbTBM_Schedules_rtModel,
} from "../../../../Data/models/TBM/TBM_schedules.model";
import TBM_schedulesEndpoints from "./endpoints/TBM_schedules.endpoint";

import { dbTBM_Stops, dbTBM_StopsModel } from "../../../../Data/models/TBM/TBM_stops.model";
import TBM_stopsEndpoint from "./endpoints/TBM_stops.endpoint";

import { dbTBM_Trips, dbTBM_TripsModel } from "../../../../Data/models/TBM/TBM_trips.model";
import TBM_tripsEndpoint from "./endpoints/TBM_trips.endpoint";

import {
  dbTBM_ScheduledRoutes,
  dbTBM_ScheduledRoutesModel,
} from "../../../../Data/models/TBM/TBMScheduledRoutes.model";
import TBMScheduledRoutesEndpoint, {
  TBMScheduledRoutesEndpointHook,
} from "./endpoints/TBMScheduledRoutes.endpoint";

declare module "../../declarations" {
  interface ExternalAPIs {
    TBM: { endpoints: Endpoint<TBMEndpoints>[] };
  }
}

export type TBMClass<E extends TBMEndpoints | undefined = undefined> = E extends TBMEndpoints.Addresses
  ? dbAddresses
  : E extends TBMEndpoints.Intersections
    ? dbIntersections
    : E extends TBMEndpoints.Sections
      ? dbSections
      : E extends TBMEndpoints.Lines
        ? dbTBM_Lines
        : E extends TBMEndpoints.Lines_routes
          ? dbTBM_Lines_routes
          : E extends TBMEndpoints.Schedules
            ? dbTBM_Schedules
            : E extends TBMEndpoints.Schedules_rt
              ? dbTBM_Schedules_rt
              : E extends TBMEndpoints.Stops
                ? dbTBM_Stops
                : E extends TBMEndpoints.Trips
                  ? dbTBM_Trips
                  : E extends TBMEndpoints.ScheduledRoutes
                    ? dbTBM_ScheduledRoutes
                    :
                        | dbAddresses
                        | dbIntersections
                        | dbSections
                        | dbTBM_Lines_routes
                        | dbTBM_Lines
                        | dbTBM_Schedules
                        | dbTBM_Schedules_rt
                        | dbTBM_Stops
                        | dbTBM_Trips
                        | dbTBM_ScheduledRoutes;

export type TBMModel<E extends TBMEndpoints | undefined = undefined> = E extends TBMEndpoints.Addresses
  ? dbAddressesModel
  : E extends TBMEndpoints.Intersections
    ? dbIntersectionsModel
    : E extends TBMEndpoints.Sections
      ? dbSectionsModel
      : E extends TBMEndpoints.Lines
        ? dbTBM_LinesModel
        : E extends TBMEndpoints.Lines_routes
          ? dbTBM_Lines_routesModel
          : E extends TBMEndpoints.Schedules
            ? dbTBM_SchedulesModel
            : E extends TBMEndpoints.Schedules_rt
              ? dbTBM_Schedules_rtModel
              : E extends TBMEndpoints.Stops
                ? dbTBM_StopsModel
                : E extends TBMEndpoints.Trips
                  ? dbTBM_TripsModel
                  : E extends TBMEndpoints.ScheduledRoutes
                    ? dbTBM_ScheduledRoutesModel
                    :
                        | dbAddressesModel
                        | dbIntersectionsModel
                        | dbSectionsModel
                        | dbTBM_Lines_routesModel
                        | dbTBM_LinesModel
                        | dbTBM_SchedulesModel
                        | dbTBM_Schedules_rtModel
                        | dbTBM_StopsModel
                        | dbTBM_TripsModel
                        | dbTBM_ScheduledRoutesModel;

export default (app: Application) => {
  /**
   * Fetch data from TBM API
   * @param {String} id dataset identifier
   * @param {Array} queries array of queries to apply
   */
  async function getData<T>(id: string, queries: string[] = []): Promise<T> {
    const bURL = "https://data.bordeaux-metropole.fr/";
    const url = `geojson?key=${app.get("TBMkey")}&typename=${id}&${queries.join("&")}`;
    const { data } = await axios.get(`${bURL}${url}`, {
      maxContentLength: 4_000_000_000,
      maxBodyLength: 4_000_000_000,
    });
    return data.features;
  }

  logger.log(`Initializing TBM models & endpoints...`);
  const TBM_lines_routesEndpointInstantiated = TBM_lines_routesEndpoint(app, getData)[0];
  const [TBM_schedulesEndpointInstantiated, TBM_schedulesRtEndpointInstantiated] = TBM_schedulesEndpoints(
    app,
    getData,
  );
  const TBM_tripsEndpointInstantiated = TBM_tripsEndpoint(app, getData)[0];

  app.externalAPIs.TBM = {
    endpoints: [
      addressesEndpoint(app, getData)[0],
      intersectionsEndpoint(app, getData)[0],
      sectionsEndpoint(app, getData)[0],
      TBM_linesEndpoint(app, getData)[0],
      TBM_lines_routesEndpointInstantiated,
      TBM_schedulesEndpointInstantiated,
      TBM_schedulesRtEndpointInstantiated,
      TBM_stopsEndpoint(app, getData)[0],
      TBM_tripsEndpointInstantiated,
      TBMScheduledRoutesEndpoint(
        app,
        TBM_lines_routesEndpointInstantiated,
        TBM_schedulesRtEndpointInstantiated,
        TBM_tripsEndpointInstantiated,
      )[0],
    ],
  };
  logger.info(`TBM models & endpoints initialized.`);

  app.externalAPIs.endpoints.push(...app.externalAPIs.TBM.endpoints);

  TBMScheduledRoutesEndpointHook(app);
};
