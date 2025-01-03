// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from "@feathersjs/schema";

import { pathQueryValidator, pathResolver, pathExternalResolver, pathQueryResolver } from "./path.schema";

import type { Application } from "../../declarations";
import { PathService, getOptions } from "./path.class";
import { pathPath, pathMethods } from "./path.shared";

export * from "./path.class";
export * from "./path.schema";

// A configure function that registers the service and its hooks via `app.configure`
export const path = (app: Application) => {
  // Register our service on the Feathers application
  app.use(pathPath, new PathService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: pathMethods,
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service(pathPath).hooks({
    around: {
      all: [schemaHooks.resolveExternal(pathExternalResolver), schemaHooks.resolveResult(pathResolver)],
    },
    before: {
      all: [schemaHooks.validateQuery(pathQueryValidator), schemaHooks.resolveQuery(pathQueryResolver)],
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
    [pathPath]: PathService;
  }
}
