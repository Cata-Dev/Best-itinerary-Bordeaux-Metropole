import type { Application } from "../../declarations";

import { ItineraryService, itineraryHooks } from "./itinerary.class";

// A configure function that registers the service and its hooks via `app.configure`
export function itinerary(app: Application) {
  const options = {
    app,
    // Service options will go here
  };

  // Register our service on the Feathers application
  app.use("itinerary", new ItineraryService(options), {
    // A list of all methods this service exposes externally
    methods: ["get"],
    // You can add additional custom events to be sent to clients here
    events: [],
  });
  // Initialize hooks
  app.service("itinerary").hooks(itineraryHooks);
}

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    itinerary: ItineraryService;
  }
}
