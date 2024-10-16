import io from "socket.io-client";
import socketio from "@feathersjs/socketio-client";
import { createClient } from "server";
import type { RefreshData } from "server";
import { Deferred } from "common/async";

const connection = socketio(
  io("https://bibm.catadev.org", {
    path: "/api/socket.io/",
    transports: ["websocket"],
    reconnectionAttempts: 2,
  }),
);
const client = createClient(connection);

const APIRefresh = new Deferred<RefreshData>();

client
  .service("refresh-data")
  .get("all", {
    query: { waitForUpdate: true },
  })
  .then(APIRefresh.resolve)
  .catch(APIRefresh.reject);

export { client, APIRefresh };
