import type { Application } from "../../declarations";

import { GeocodeService, geocodeHooks } from "./geocode.class";

// A configure function that registers the service and its hooks via `app.configure`
export function geocode(app: Application) {
  const options = {
    app,
    // Service options will go here
  };

  // Register our service on the Feathers application
  app.use("geocode", new GeocodeService(options), {
    // A list of all methods this service exposes externally
    methods: ["find", "get"],
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service("geocode").hooks(geocodeHooks);
}

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    geocode: GeocodeService;
  }
}
