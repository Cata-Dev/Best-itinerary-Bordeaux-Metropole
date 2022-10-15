import "@feathersjs/transport-commons";
import { RealTimeConnection } from "@feathersjs/transport-commons";
import type { Application } from "./declarations";

export const channels = (app: Application) => {
  if (typeof app.channel !== "function") {
    // If no real-time functionality has been configured just return
    return;
  }

  app.on("connection", (connection: RealTimeConnection) => {
    // On a new real-time connection, add it to the anonymous channel
    app.channel("anonymous").join(connection);
  });

  // Here you can also add service specific event publishers
  // e.g. the publish the `users` service `created` event to the `admins` channel
  // app.service('users').publish('created', () => app.channel('admins'))

  app.service("refresh-data").publish(() => {
    return [app.channel(`anonymous`)];
  });
};
