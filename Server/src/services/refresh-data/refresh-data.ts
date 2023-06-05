// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from "@feathersjs/schema";
import { disallow } from "feathers-hooks-common";

import {
  refreshDataQueryValidator,
  refreshDataResolver,
  refreshDataExternalResolver,
  refreshDataQueryResolver,
} from "./refresh-data.schema";

import type { Application } from "../../declarations";
import { RefreshDataService, getOptions } from "./refresh-data.class";
import { refreshDataPath, refreshDataMethods } from "./refresh-data.shared";

export * from "./refresh-data.class";
export * from "./refresh-data.schema";

// A configure function that registers the service and its hooks via `app.configure`
export function refreshData(app: Application) {
  // Register our service on the Feathers application
  app.use(refreshDataPath, new RefreshDataService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: refreshDataMethods,
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service(refreshDataPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(refreshDataExternalResolver),
        schemaHooks.resolveResult(refreshDataResolver),
      ],
    },
    before: {
      all: [
        disallow("external"),
        schemaHooks.validateQuery(refreshDataQueryValidator),
        schemaHooks.resolveQuery(refreshDataQueryResolver),
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
}

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    [refreshDataPath]: RefreshDataService;
  }
}
