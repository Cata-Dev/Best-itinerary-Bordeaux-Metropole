import { Deferred } from "@bibm/common/async";
import type { RefreshData } from "@bibm/server";
import { createClient } from "@bibm/server";
import socketio from "@feathersjs/socketio-client";
import io from "socket.io-client";

const connection = socketio(
  io(import.meta.env.VITE_API_URL, {
    path: import.meta.env.VITE_API_PATH,
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

export { APIRefresh, client };
