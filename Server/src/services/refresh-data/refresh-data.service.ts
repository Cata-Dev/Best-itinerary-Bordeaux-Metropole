import type { Application } from "../../declarations";

import { RefreshDataService, refreshDataHooks } from "./refresh-data.class";

// A configure function that registers the service and its hooks via `app.configure`
export function refreshData(app: Application) {
  const options = {
    app,
    // Service options will go here
  };

  // Register our service on the Feathers application
  app.use("refresh-data", new RefreshDataService(options), {
    // A list of all methods this service exposes externally
    methods: ["get"],
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service("refresh-data").hooks(refreshDataHooks);
}

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    "refresh-data": RefreshDataService;
  }
}
