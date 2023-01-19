// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from "@feathersjs/schema";

import {
  geocodeQueryValidator,
  geocodeResolver,
  geocodeExternalResolver,
  geocodeQueryResolver,
} from "./geocode.schema";

import type { Application } from "../../declarations";
import { GeocodeService, getOptions } from "./geocode.class";

export * from "./geocode.class";
export * from "./geocode.schema";

// A configure function that registers the service and its hooks via `app.configure`
export function geocode(app: Application) {
  // Register our service on the Feathers application
  app.use("geocode", new GeocodeService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: ["find", "get"],
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service("geocode").hooks({
    around: {
      all: [schemaHooks.resolveExternal(geocodeExternalResolver), schemaHooks.resolveResult(geocodeResolver)],
    },
    before: {
      all: [schemaHooks.validateQuery(geocodeQueryValidator), schemaHooks.resolveQuery(geocodeQueryResolver)],
      find: [],
      get: [],
    },
    after: {
      all: [],
    },
    error: {
      all: [],
    },
  });
}

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    geocode: GeocodeService;
  }
}
