import { Application } from "../declarations";

import tbm, { TBMEndpoints, TBMSchema } from "./TBM";
import sncf, { SNCFEndpoints, SNCFSchema } from "./SNCF";
import { Endpoint } from "./endpoint";
import { logger } from "../logger";

export const setupExternalAPIs = async (app: Application) => {
  app.externalAPIs = { endpoints: [] } as never;

  tbm(app);
  sncf(app);

  async function refresh() {
    for (const endpoint of app.externalAPIs.endpoints.filter((endpoint) => endpoint.rate >= 24 * 3600)) {
      try {
        endpoint.fetch(undefined, app.get("debug"));
      } catch (e) {
        logger.error(e);
      }
    }
  }

  await refresh();
  setInterval(refresh, Math.max(...app.externalAPIs.endpoints.map((endpoint) => endpoint.rate)) * 1000);
};

export type EndpointName = TBMEndpoints | SNCFEndpoints;

export type ProviderSchema<E extends EndpointName | undefined = undefined> = E extends TBMEndpoints
  ? TBMSchema<E>
  : E extends SNCFEndpoints
  ? SNCFSchema<E>
  : TBMSchema<TBMEndpoints> | SNCFSchema<SNCFEndpoints>;

declare module "../declarations" {
  interface ExternalAPIs {
    endpoints: Endpoint<EndpointName>[];
  }
}
