import { hooks as schemaHooks } from "@feathersjs/schema";

import {
  journeyQueryValidator,
  journeyResolver,
  journeyExternalResolver,
  journeyQueryResolver,
} from "./journey.schema";

import type { Application } from "../../declarations";
import { JourneyService, getOptions } from "./journey.class";
import { journeyPath, journeyMethods } from "./journey.shared";

export * from "./journey.class";
export * from "./journey.schema";

// A configure function that registers the service and its hooks via `app.configure`
export const journey = (app: Application) => {
  // Register our service on the Feathers application
  app.use(journeyPath, new JourneyService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: journeyMethods,
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service(journeyPath).hooks({
    around: {
      all: [schemaHooks.resolveExternal(journeyExternalResolver), schemaHooks.resolveResult(journeyResolver)],
    },
    before: {
      all: [schemaHooks.validateQuery(journeyQueryValidator), schemaHooks.resolveQuery(journeyQueryResolver)],
      get: [],
      find: [],
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
    [journeyPath]: JourneyService;
  }
}
