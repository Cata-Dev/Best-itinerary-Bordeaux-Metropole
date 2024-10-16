import io from "socket.io-client";
import socketio from "@feathersjs/socketio-client";
import type { TBMEndpoints } from "server/externalAPIs/TBM/index";
import { createClient } from "server";
import type { Itinerary, ItineraryQuery } from "server";
import type { TransportMode } from "../";

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

interface ItineraryQueryLocationOverride {
  type: Exclude<TransportMode, "FOOT"> | TBMEndpoints.Addresses;
}

type Location = Omit<ItineraryQuery["from"], keyof ItineraryQueryLocationOverride> &
  ItineraryQueryLocationOverride;

const defaultLocation = {
  id: -1,
  type: "Addresses" as TBMEndpoints.Addresses,
  coords: [-1, -1] satisfies [unknown, unknown],
  alias: "unknown",
} satisfies Location;

client
  .service("itinerary")
  .get("paths", {
    query: { waitForUpdate: true, from: defaultLocation, to: defaultLocation },
  })
  .then((r) => {
    if (r.code && r.code == 200) {
      APIRefresh.resolve(r);
    } else APIRefresh.reject(r);
  })
  .catch((e) => {
    APIRefresh.reject(e);
  });

export { client, APIRefresh, defaultLocation };
export type { Location };
