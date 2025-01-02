import { Application, ExternalAPIs } from "../declarations";

import tbm, { TBMEndpoints, TBMClass, TBMModel } from "./TBM";
import sncf, { SNCFEndpoints, SNCFClass, SNCFModel } from "./SNCF";
import { Endpoint } from "./endpoint";
import { logger } from "../logger";

export const setupExternalAPIs = (app: Application) => {
  app.externalAPIs = { endpoints: {} } as ExternalAPIs;

  tbm(app);
  sncf(app);

  function refresh() {
    for (const endpoint of Object.values(app.externalAPIs.endpoints).filter(
      (endpoint) => endpoint.rate >= 24 * 3600 && endpoint.rate < Infinity,
    )) {
      endpoint.fetch(undefined, app.get("debug")).catch((e) => logger.error(e));
    }
  }

  refresh();
  setInterval(
    refresh,
    Math.max(
      ...Object.values(app.externalAPIs.endpoints).map((endpoint) =>
        endpoint.rate < Infinity ? endpoint.rate : 0,
      ),
    ) * 1000,
  );
};

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

type getKey<O> = O extends Record<infer K, unknown> ? K : never;
// Retrieve keys of endpoints providers
export type EndpointName = getKey<ExternalAPIs[Exclude<keyof ExternalAPIs, "endpoints">]["endpoints"]>;

declare module "../declarations" {
  interface ExternalAPIs {
    endpoints: { [EN in EndpointName]: Endpoint<EN> };
  }
}
