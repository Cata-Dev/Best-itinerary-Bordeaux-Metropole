import { Application } from "../declarations";

import tbm, { TBMEndpoints, TBMClass, TBMModel } from "./TBM";
import sncf, { SNCFEndpoints, SNCFClass, SNCFModel } from "./SNCF";
import { Endpoint } from "./endpoint";
import { logger } from "../logger";

export const setupExternalAPIs = async (app: Application) => {
  app.externalAPIs = { endpoints: [] } as never;

  tbm(app);
  sncf(app);

  async function refresh() {
    for (const endpoint of app.externalAPIs.endpoints.filter(
      (endpoint) => endpoint.rate >= 24 * 3600 && endpoint.rate < Infinity,
    )) {
      try {
        endpoint.fetch(undefined, app.get("debug")).catch();
      } catch (e) {
        logger.error(e);
      }
    }
  }

  await refresh();
  setInterval(
    refresh,
    Math.max(
      ...app.externalAPIs.endpoints.map((endpoint) => (endpoint.rate < Infinity ? endpoint.rate : 0)),
    ) * 1000,
  );
};

export type EndpointName = TBMEndpoints | SNCFEndpoints;

export type ProviderClass<E extends EndpointName | undefined = undefined> = E extends TBMEndpoints
  ? TBMClass<E>
  : E extends SNCFEndpoints
  ? SNCFClass<E>
  : TBMClass<TBMEndpoints> | SNCFClass<SNCFEndpoints>;

export type ProviderModel<E extends EndpointName | undefined = undefined> = E extends TBMEndpoints
  ? TBMModel<E>
  : E extends SNCFEndpoints
  ? SNCFModel<E>
  : TBMModel<TBMEndpoints> | SNCFModel<SNCFEndpoints>;

declare module "../declarations" {
  interface ExternalAPIs {
    endpoints: Endpoint<EndpointName>[];
  }
}
