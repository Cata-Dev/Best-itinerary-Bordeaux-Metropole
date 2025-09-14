import { Deferred } from "@bibm/common/async";
import type { RefreshData } from "@bibm/server";
import { createClient } from "@bibm/server";
import socketio from "@feathersjs/socketio-client";
import io from "socket.io-client";
import { ref } from "vue";

enum ClientStatus {
  Connecting,
  ConnectionError,
  Connected,
}

const clientStatus = ref<ClientStatus>(ClientStatus.Connecting);

const connection = socketio(
  io(import.meta.env.VITE_API_URL, {
    path: import.meta.env.VITE_API_PATH,
    transports: ["websocket"],
    reconnectionAttempts: 2,
  }),
);
const client = createClient(connection);

// https://feathersjs.com/api/client/socketio.html#app-io
// https://socket.io/docs/v4/client-api/#events-1
(client.io as ReturnType<typeof io>).io.on("reconnect_failed", () => {
  clientStatus.value = ClientStatus.ConnectionError;
});

(client.io as ReturnType<typeof io>).on("connect", () => {
  clientStatus.value = ClientStatus.Connected;
});

(client.io as ReturnType<typeof io>).io.on("reconnect_attempt", () => {
  clientStatus.value = ClientStatus.Connecting;
});

const APIRefresh = new Deferred<RefreshData>();

client
  .service("refresh-data")
  .get("all", {
    query: { waitForUpdate: true },
  })
  .then(APIRefresh.resolve)
  .catch(APIRefresh.reject);

export { APIRefresh, client, ClientStatus, clientStatus };
