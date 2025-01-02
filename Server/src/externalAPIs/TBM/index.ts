// Top exports to avoid double-importing
import { TBMEndpoints } from "data/lib/models/TBM";

export interface BaseTBM<T extends object = object> {
  properties: T;
}

import axios from "axios";
import { Application } from "../../declarations";
import { logger } from "../../logger";
import { Endpoint } from "../endpoint";

import addressesEndpoint from "./endpoints/addresses.endpoint";

import sectionsEndpoint from "./endpoints/sections.endpoint";

import TBM_linesEndpoint from "./endpoints/TBM_lines.endpoint";

import TBM_lines_routesEndpoint from "./endpoints/TBM_lines_routes.endpoint";

import TBM_schedulesEndpoints from "./endpoints/TBM_schedules.endpoint";

import TBM_stopsEndpoint from "./endpoints/TBM_stops.endpoint";

import TBM_tripsEndpoint from "./endpoints/TBM_trips.endpoint";

import TBMScheduledRoutesEndpoint, {
  TBMScheduledRoutesEndpointHook,
} from "./endpoints/TBMScheduledRoutes.endpoint";

declare module "../../declarations" {
  interface ExternalAPIs {
    TBM: { endpoints: { [EN in Exclude<TBMEndpoints, TBMEndpoints.Intersections>]: Endpoint<EN> } };
  }
}

export default (app: Application) => {
  /**
   * Fetch data from TBM API
   * @param {String} id dataset identifier
   * @param {Array} queries array of queries to apply
   */
  async function getData<T>(id: string, queries: string[] = []): Promise<T> {
    const bURL = "https://data.bordeaux-metropole.fr/";
    const url = `geojson?key=${app.get("server").TBMkey}&typename=${id}&${queries.join("&")}`;
    const { data }: { data: { features: T } } = await axios.get(`${bURL}${url}`, {
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
    endpoints: {
      [TBMEndpoints.Addresses]: addressesEndpoint(app, getData)[0],
      [TBMEndpoints.Sections]: sectionsEndpoint(app, getData)[0],
      [TBMEndpoints.Lines]: TBM_linesEndpoint(app, getData)[0],
      [TBMEndpoints.Lines_routes]: TBM_lines_routesEndpointInstantiated,
      [TBMEndpoints.Schedules]: TBM_schedulesEndpointInstantiated,
      [TBMEndpoints.Schedules_rt]: TBM_schedulesRtEndpointInstantiated,
      [TBMEndpoints.Stops]: TBM_stopsEndpoint(app, getData)[0],
      [TBMEndpoints.Trips]: TBM_tripsEndpointInstantiated,
      [TBMEndpoints.ScheduledRoutes]: TBMScheduledRoutesEndpoint(
        app,
        TBM_lines_routesEndpointInstantiated,
        TBM_schedulesRtEndpointInstantiated,
        TBM_tripsEndpointInstantiated,
      )[0],
    },
  };
  logger.info(`TBM models & endpoints initialized.`);

  app.externalAPIs.endpoints = { ...app.externalAPIs.endpoints, ...app.externalAPIs.TBM };

  TBMScheduledRoutesEndpointHook(app);
};
