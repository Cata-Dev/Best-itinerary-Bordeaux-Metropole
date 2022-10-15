import type { Hook, Id, Params } from "@feathersjs/feathers";
import { resolveAll } from "@feathersjs/schema";

import type { RefreshDataResult, RefreshDataQuery } from "./refresh-data.schema";
import { refreshDataResolvers } from "./refresh-data.resolver";

import { disallow } from "feathers-hooks-common";

export const refreshDataHooks = {
  around: {
    all: [resolveAll(refreshDataResolvers)],
  },
  before: {
    all: [disallow("external") as unknown as Hook<Application, RefreshDataService>],
  },
  after: {},
  error: {},
};

import type { Application } from "../../declarations";
import { Forbidden, GeneralError, NotFound } from "@feathersjs/errors";

export interface RefreshDataServiceOptions {
  app: Application;
}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class RefreshDataService {
  private readonly app: Application;

  constructor(public options: RefreshDataServiceOptions) {
    this.app = options.app;
  }

  async get(id: Id, _params?: Params<RefreshDataQuery>): Promise<RefreshDataResult> {
    const endpoints = this.app.externalAPIs.endpoints;
    const waitForUpdate = (_params && _params.query?.waitForUpdate) ?? false;
    const force = (_params && _params.query?.force) ?? false;
    const matchingEndpoint = endpoints.find((endpoint) => endpoint.name === id);

    if (id == "all") {
      return new Promise((res) => {
        let sucess = 0;
        let count = 0;
        let lastActualization = 0;
        for (const endpoint of endpoints) {
          this.get(endpoint.name, _params)
            .then((r) => {
              if (r.actualized) sucess++, (lastActualization = Date.now());
              lastActualization = Date.now();
            })
            .catch((r) => {
              if (r.lastActualization > lastActualization) lastActualization = r.lastActualization;
            })
            .finally(() => {
              if (waitForUpdate) {
                count++;
                if (count === endpoints.length)
                  //every update ended
                  res({
                    actualized: sucess,
                    lastActualization: lastActualization,
                  });
              }
            });
        }
        if (!waitForUpdate)
          res({
            //we don't know anything
            actualized: null,
            lastActualization: 0,
          });
      });
    } else if (matchingEndpoint) {
      if (matchingEndpoint.fetching) {
        if (waitForUpdate) await matchingEndpoint.fetchPromise;
        throw new Forbidden({
          actualized: false,
          lastActualization: matchingEndpoint.lastFetch,
          Reason: "Actualization is ongoing.",
        });
      }
      if (_params && _params.query?.force !== true && matchingEndpoint.onCooldown)
        throw new Forbidden({
          actualized: false,
          lastActualization: matchingEndpoint.lastFetch,
          Reason: "Actualization is on cooldown.",
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
      } else {
        matchingEndpoint.fetch(force, this.app.get("debug"));
        return {
          actualized: null, //we don't know anything
          lastActualization: matchingEndpoint.lastFetch,
        };
      }
    } else throw new NotFound(`Unknown path.`);
  }
}
