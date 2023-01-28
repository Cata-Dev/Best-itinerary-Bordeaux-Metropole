import io from "socket.io-client";
import socketio from "@feathersjs/socketio-client";
import { createClient } from "server";
import type { Itinerary } from "server";

const connection = socketio(
  io("https://bibm.catadev.org", {
    path: "/api/socket.io/",
    transports: ["websocket"],
    reconnectionAttempts: 2,
  }),
);
const client = createClient(connection);

interface PromisedAPI {
  result: Promise<Itinerary>;
  resolve: (value: Itinerary) => void;
  reject: (reason?: { code?: number }) => void;
}

const APIRefresh: PromisedAPI = {} as PromisedAPI;

APIRefresh.result = new Promise((resolve, reject) => {
  APIRefresh.resolve = resolve;
  APIRefresh.reject = reject;
});

client
  .service("itinerary")
  .get("paths", {
    query: { waitForUpdate: true, from: "unknow", to: "unknow" },
  })
  .then((r) => {
    if (r.code && r.code == 200) {
      APIRefresh.resolve(r);
    } else APIRefresh.reject(r);
  })
  .catch((e) => {
    APIRefresh.reject(e);
  });

export { client, APIRefresh };
