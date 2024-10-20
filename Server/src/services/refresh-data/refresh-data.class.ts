// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import type { RefreshData, RefreshDataData, RefreshDataPatch, RefreshDataQuery } from "./refresh-data.schema";

export type { RefreshData, RefreshDataData, RefreshDataPatch, RefreshDataQuery };

export interface RefreshDataServiceOptions {
  app: Application;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RefreshDataParams extends Params<RefreshDataQuery> {}

import { Forbidden, GeneralError, NotFound } from "@feathersjs/errors";

export function hasLastActualization(obj: unknown): obj is { lastActualization: number } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "lastActualization" in obj &&
    typeof obj.lastActualization == "number"
  );
}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class RefreshDataService<ServiceParams extends RefreshDataParams = RefreshDataParams>
  implements ServiceInterface<RefreshData, RefreshDataData, ServiceParams, RefreshDataPatch>
{
  private readonly app: Application;

  constructor(public options: RefreshDataServiceOptions) {
    this.app = options.app;
  }

  async get(id: Id, _params?: ServiceParams): Promise<RefreshData> {
    const endpoints = this.app.externalAPIs.endpoints;
    const waitForUpdate = (_params && _params.query?.waitForUpdate) ?? false;
    const force = (_params && _params.query?.force) ?? false;

    if (id === "all")
      return new Promise((res) => {
        let success = 0;
        let count = 0;
        let lastActualization = 0;

        for (const endpoint of endpoints) {
          this.get(endpoint.name, _params)
            .then((r) => {
              if (r.actualized) {
                success++;
                lastActualization = Date.now();
              }
              lastActualization = Date.now();
            })
            .catch((r) => {
              if (hasLastActualization(r) && r.lastActualization > lastActualization)
                lastActualization = r.lastActualization;
            })
            .finally(() => {
              if (waitForUpdate) {
                count++;
                if (count === endpoints.length)
                  // Every update ended
                  res({
                    actualized: success,
                    lastActualization: lastActualization,
                  });
              }
            });
        }

        if (!waitForUpdate)
          res({
            // We don't know anything
            actualized: null,
            lastActualization: 0,
          });
      });

    const matchingEndpoint = endpoints.find((endpoint) => endpoint.name === id);
    if (!matchingEndpoint) throw new NotFound(`Unknown endpoint.`);

    if (matchingEndpoint.fetching) {
      if (waitForUpdate) await matchingEndpoint.fetchPromise;
      throw new Forbidden({
        actualized: false,
        lastActualization: matchingEndpoint.lastFetch,
        Reason: `Actualization of ${matchingEndpoint.name} ${waitForUpdate ? "was" : "is"} ongoing.`,
      });
    }

    if (_params && _params.query?.force !== true && matchingEndpoint.onCooldown)
      throw new Forbidden({
        actualized: false,
        lastActualization: matchingEndpoint.lastFetch,
        Reason: `Actualization of ${matchingEndpoint.name} is on cooldown.`,
      });

    if (waitForUpdate) {
      let r = false;

      try {
        r = await matchingEndpoint.fetch(force, this.app.get("debug"));
        return {
          actualized: r,
          lastActualization: matchingEndpoint.lastFetch,
        };
      } catch (e) {
        throw new GeneralError(JSON.stringify(e), {
          actualized: false,
          lastActualization: matchingEndpoint.lastFetch,
        });
      }
    }

    void matchingEndpoint.fetch(force, this.app.get("debug"));
    return {
      // We don't know anything
      actualized: null,
      lastActualization: matchingEndpoint.lastFetch,
    };
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
