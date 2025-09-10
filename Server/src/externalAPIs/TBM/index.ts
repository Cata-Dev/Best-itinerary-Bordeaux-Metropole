// Top exports to avoid double-importing
import { TBMEndpoints } from "@bibm/data/models/TBM/index";

export interface BaseTBM<T extends object = object> {
  properties: T;
}

import axios from "axios";
import { Application } from "../../declarations";
import { logger } from "../../logger";
import { Endpoint } from "../endpoint";

import addressesEndpoint from "./endpoints/addresses.endpoint";

import sectionsEndpoint from "./endpoints/sections.endpoint";

import intersectionsEndpoint from "./endpoints/intersections.endpoint";

import TBM_linesEndpoint from "./endpoints/TBM_lines.endpoint";

import TBM_lines_routesEndpoint from "./endpoints/TBM_lines_routes.endpoint";

import TBM_schedulesEndpoints from "./endpoints/TBM_schedules.endpoint";

import TBM_stopsEndpoint from "./endpoints/TBM_stops.endpoint";

import TBM_tripsEndpoint from "./endpoints/TBM_trips.endpoint";

import TBMScheduledRoutesEndpoint from "./endpoints/TBMScheduledRoutes.endpoint";

import TBM_route_sections from "./endpoints/TBM_route_sections.endpoint";

import TBM_link_line_routes_sections from "./endpoints/TBM_link_line_routes_sections.endpoint";

declare module "../../declarations" {
  interface ExternalAPIs {
    TBM: { endpoints: { [EN in TBMEndpoints]: Endpoint<EN> } };
  }
}

export default async (app: Application) => {
  function makeGetData<T>(
    makeURL: (id: string, queries: string[]) => string,
  ): (id: string, queries?: string[]) => Promise<T> {
    return async (id: string, queries: string[] = []) => {
      const bURL = "https://data.bordeaux-metropole.fr/";
      const url = makeURL(id, queries);
      const res = await axios.get<{ features: T }>(`${bURL}${url}`, {
        maxContentLength: 500_000_000,
        maxBodyLength: 500_000_000,
      });
      if (app.get("debug")) logger.debug(`Fetched "${bURL}${url}": ${res.status} ${res.statusText}`);
      return res.data.features;
    };
  }
  /**
   * Fetch data from TBM API
   * @param {String} id dataset identifier
   * @param {Array} queries array of queries to apply
   */
  const getData: <T>(id: string, queries?: string[]) => Promise<T> = makeGetData(
    (id, queries) => `geojson?key=${app.get("server").TBMkey}&typename=${id}&${queries.join("&")}`,
  );
  /**
   * Fetch data from TBM API
   * @param {String} relation Id of relation
   * @param {Array} queries array of queries to apply
   */
  const getRelationData: <T>(relation: string, queries?: string[]) => Promise<T> = makeGetData(
    (id, queries) => `geojson/relations/${id}?key=${app.get("server").TBMkey}&${queries.join("&")}`,
  );

  logger.log(`Initializing TBM models & endpoints...`);
  const TBM_lines_routesEndpointInstantiated = (await TBM_lines_routesEndpoint(app, getData))[0];
  const [TBM_schedulesEndpointInstantiated, TBM_schedulesRtEndpointInstantiated] =
    await TBM_schedulesEndpoints(app, getData);
  const TBM_tripsEndpointInstantiated = (await TBM_tripsEndpoint(app, getData))[0];
  const TBM_link_line_routes_sectionsEndpointInstantiated = (
    await TBM_link_line_routes_sections(app, getRelationData)
  )[0];

  app.externalAPIs.TBM = {
    endpoints: {
      [TBMEndpoints.Addresses]: (await addressesEndpoint(app, getData))[0],
      [TBMEndpoints.Sections]: (await sectionsEndpoint(app, getData))[0],
      [TBMEndpoints.Intersections]: (await intersectionsEndpoint(app, getData))[0],
      [TBMEndpoints.Lines]: (await TBM_linesEndpoint(app, getData))[0],
      [TBMEndpoints.Lines_routes]: TBM_lines_routesEndpointInstantiated,
      [TBMEndpoints.Schedules]: TBM_schedulesEndpointInstantiated,
      [TBMEndpoints.Schedules_rt]: TBM_schedulesRtEndpointInstantiated,
      [TBMEndpoints.Stops]: (await TBM_stopsEndpoint(app, getData))[0],
      [TBMEndpoints.Trips]: TBM_tripsEndpointInstantiated,
      [TBMEndpoints.ScheduledRoutes]: (
        await TBMScheduledRoutesEndpoint(
          app,
          TBM_lines_routesEndpointInstantiated,
          TBM_schedulesRtEndpointInstantiated,
          TBM_tripsEndpointInstantiated,
          TBM_link_line_routes_sectionsEndpointInstantiated,
        )
      )[0],
      [TBMEndpoints.RouteSections]: (await TBM_route_sections(app, getData))[0],
      [TBMEndpoints.LinkLineRoutesSections]: TBM_link_line_routes_sectionsEndpointInstantiated,
    },
  };
  logger.info(`TBM models & endpoints initialized.`);

  app.externalAPIs.endpoints = { ...app.externalAPIs.endpoints, ...app.externalAPIs.TBM.endpoints };
};
