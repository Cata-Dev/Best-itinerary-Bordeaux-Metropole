import { hooks as schemaHooks } from "@feathersjs/schema";

import {
  itineraryQueryValidator,
  itineraryResolver,
  itineraryExternalResolver,
  itineraryQueryResolver,
} from "./itinerary.schema";

import type { Application } from "../../declarations";
import { ItineraryService, getOptions } from "./itinerary.class";

export * from "./itinerary.class";
export * from "./itinerary.schema";

// A configure function that registers the service and its hooks via `app.configure`
export const itinerary = (app: Application) => {
  // Register our service on the Feathers application
  app.use("itinerary", new ItineraryService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: ["get"],
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service("itinerary").hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(itineraryExternalResolver),
        schemaHooks.resolveResult(itineraryResolver),
      ],
    },
    before: {
      all: [
        schemaHooks.validateQuery(itineraryQueryValidator),
        schemaHooks.resolveQuery(itineraryQueryResolver),
      ],
      get: [],
    },
    after: {
      all: [],
    },
    error: {
      all: [],
    },
  });
};

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    itinerary: ItineraryService;
  }
}
