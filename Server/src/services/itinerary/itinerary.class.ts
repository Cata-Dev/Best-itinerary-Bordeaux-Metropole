// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import type { Itinerary, ItineraryData, ItineraryPatch, ItineraryQuery } from "./itinerary.schema";

export type { Itinerary, ItineraryData, ItineraryPatch, ItineraryQuery };

export interface ItineraryServiceOptions {
  app: Application;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ItineraryParams extends Params<ItineraryQuery> {}

import { BadRequest, NotFound } from "@feathersjs/errors";

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class ItineraryService<ServiceParams extends Params = ItineraryParams>
  implements ServiceInterface<Itinerary, ItineraryData, ServiceParams, ItineraryPatch>
{
  private readonly app: Application;

  constructor(public options: ItineraryServiceOptions) {
    this.app = options.app;
  }

  async get(id: Id, _params?: ServiceParams): Promise<Itinerary> {
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
              paths: [
                {
                  id: "6541ed4dze", //unique ID referencing result in Database. Allows result to be saved.
                  totalDuration: 1563, //seconds
                  totalDistance: 34230, //meters
                  departure: Date.now(),
                  from: "4 Rue du Pont de la Grave Bègles",
                  stages: [
                    { type: "FOOT", to: "France Alouette", duration: 163, details: { distance: 150 } },
                    {
                      type: "TBM",
                      to: "Village Cap de Bos",
                      duration: 365,
                      details: {
                        type: "BUS",
                        line: "44",
                        direction: "Pessac Candau",
                        departure: Date.now() + 163 * 1000,
                      },
                    },
                    { type: "FOOT", to: "France Alouette", duration: 324, details: { distance: 221 } },
                    {
                      type: "SNCF",
                      to: "France Alouette",
                      duration: 850,
                      details: {
                        type: "TRAIN",
                        line: "TER-NA",
                        direction: "Bordeaux Saint-Jean",
                        departure: Date.now() + 528 * 1000,
                      },
                    },
                    {
                      type: "FOOT",
                      to: "Lycée Général et Technologique Pape Clément",
                      duration: 185,
                      details: { distance: 168 },
                    },
                  ],
                },
              ],
            });
          }
        });
      }
      default:
        throw new NotFound("Unknown command.");
    }
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
