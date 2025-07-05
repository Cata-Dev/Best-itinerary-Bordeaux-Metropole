import { Application, ExternalAPIs } from "../declarations";

import { mapAsync } from "@bibm/common/async";
import { SNCFClass, SNCFEndpoints, SNCFModel } from "@bibm/data/models/SNCF/index";
import { TBMClass, TBMEndpoints, TBMModel } from "@bibm/data/models/TBM/index";
import { logger } from "../logger";
import sncf from "./SNCF";
import tbm from "./TBM";
import { Endpoint } from "./endpoint";

export const setupExternalAPIs = async (app: Application) => {
  app.externalAPIs = { endpoints: {} } as ExternalAPIs;

  await tbm(app).catch((err) => logger.error("Error during TBM setup", err));
  await sncf(app).catch((err) => logger.error("Error during SNCF setup", err));

  const refresh = () =>
    mapAsync(
      Object.values(app.externalAPIs.endpoints).filter(
        (endpoint) => endpoint.rate >= 24 * 3600 && endpoint.rate < Infinity,
      ),
      (endpoint) => endpoint.fetch(undefined, app.get("debug")).catch((e) => logger.warn(e)),
    );

  setInterval(
    () => void refresh(),
    Math.max(
      ...Object.values(app.externalAPIs.endpoints).map((endpoint) =>
        endpoint.rate < Infinity ? endpoint.rate : 0,
      ),
    ) * 1000,
  );

  return refresh;
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
