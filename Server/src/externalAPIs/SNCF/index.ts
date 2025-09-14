import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";

import axios from "axios";
import { Application } from "../../declarations";
import { logger } from "../../logger";
import { Endpoint } from "../endpoint";

import SNCF_StopsEndpoint from "./endpoints/SNCF_Stops.endpoint";

import SNCF_SchedulesEndpoint from "./endpoints/SNCF_Schedules.endpoint";

import SNCF_ScheduledRoutesEndpoint from "./endpoints/SNCFScheduledRoutes.endpoint";

declare module "../../declarations" {
  interface ExternalAPIs {
    SNCF: { endpoints: { [EN in SNCFEndpoints]: Endpoint<EN> } };
  }
}

export default async (app: Application) => {
  /**
   * Fetch data from SNCF API
   * @param {Array} paths
   * @param {Array} feature
   * @param {Array} queries
   */
  async function getData<T>(
    paths: Record<string, string>,
    feature: string,
    queries: Record<string, string | number> = {},
  ): Promise<T> {
    const bURL = "https://api.sncf.com/v1";
    const url = `/${Object.keys(paths)
      .map((k) => `${k}/${paths[k]}`)
      .join("/")}/${feature}?key=${app.get("server").SNCFkey}&${Object.keys(queries)
      .map((k) => `${k}=${queries[k]}`)
      .join("&")}`;
    const res = await axios.get<T>(`${bURL}${url}`);
    if (app.get("debug")) logger.debug(`Fetched "${bURL}${url}": ${res.status} ${res.statusText}`);
    return res.data;
  }

  logger.log(`Initializing SNCF endpoints...`);

  const SNCF_SchedulesEndpointInstantiated = (await SNCF_SchedulesEndpoint(app, getData))[0];

  app.externalAPIs.SNCF = {
    endpoints: {
      [SNCFEndpoints.Stops]: (await SNCF_StopsEndpoint(app, getData))[0],
      [SNCFEndpoints.Schedules]: SNCF_SchedulesEndpointInstantiated,
      [SNCFEndpoints.ScheduledRoutes]: (
        await SNCF_ScheduledRoutesEndpoint(app, SNCF_SchedulesEndpointInstantiated)
      )[0],
    },
  };

  logger.info(`SNCF endpoints initialized.`);

  app.externalAPIs.endpoints = { ...app.externalAPIs.endpoints, ...app.externalAPIs.SNCF.endpoints };
};
