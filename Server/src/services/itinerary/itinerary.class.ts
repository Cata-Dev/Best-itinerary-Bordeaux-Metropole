import type { Id, Params } from "@feathersjs/feathers";
import { resolveAll } from "@feathersjs/schema";

import type { ItineraryResult, ItineraryQuery } from "./itinerary.schema";
import { itineraryResolvers } from "./itinerary.resolver";

export const itineraryHooks = {
  around: {
    all: [resolveAll(itineraryResolvers)],
  },
  before: {},
  after: {},
  error: {},
};

import type { Application } from "../../declarations";
import { BadRequest, NotFound } from "@feathersjs/errors";

export interface ItineraryServiceOptions {
  app: Application;
}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class ItineraryService {
  private readonly app: Application;

  constructor(public options: ItineraryServiceOptions) {
    this.app = options.app;
  }

  async get(id: Id, _params?: Params<ItineraryQuery>): Promise<ItineraryResult> {
    switch (id) {
      case "paths": {
        const waitForUpdate = (_params && _params.query?.waitForUpdate) ?? false;
        return new Promise((res) => {
          if (!_params || !(_params.query?.from && _params.query?.to))
            throw new BadRequest(`Missing parameter(s).`);

          const endpoints = this.app.externalAPIs.endpoints.filter((endpoint) => endpoint.rate < 24 * 3600);
          let count = 0;
          let lastActualization = 0;
          //ask for possible non-daily data actualization
          for (const endpoint of endpoints) {
            this.app
              .service("refresh-data")
              .get(endpoint.name, {
                query: {
                  waitForUpdate: _params.query?.waitForUpdate ?? false,
                  force: _params.query?.force ?? false,
                },
              })
              .then(() => {
                if (waitForUpdate) lastActualization = Date.now();
              })
              .catch((r) => {
                if (waitForUpdate && r.data.lastActualization > lastActualization)
                  lastActualization = r.data.lastActualization;
              })
              .finally(() => {
                if (waitForUpdate) {
                  count++;
                  if (count === endpoints.length) compute();
                }
              });
          }

          if (!waitForUpdate) compute();

          //temporary
          function compute() {
            res({
              code: 200,
              message: "Should calculate rust best itineraries, but OK.",
              lastActualization,
              paths: [],
            });
          }
        });
      }
      default:
        throw new NotFound("Unknown command.");
    }
  }
}
