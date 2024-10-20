import type { TBMEndpoints } from "server/externalAPIs/TBM/index";
import type { ItineraryQuery } from "server";
import { theme, toggleDarkMode } from "./theme/theme";
import { client, APIRefresh } from "./feathers/feathers";
import { formatDateToInput, type TransportMode, type TransportProvider } from "./utils";
import type { SNCFEndpoints } from "server/externalAPIs/SNCF/index";

interface QuerySettings {
  departureTime: string;
  maxWalkDistance: number;
  walkSpeed: number;
  transports: Partial<Record<TransportProvider, boolean>>;
}

const defaultQuerySettings: QuerySettings = {
  departureTime: formatDateToInput(new Date()),
  maxWalkDistance: 1000,
  walkSpeed: 5.0,
  transports: {
    TBM: true,
    SNCF: true,
  },
};

interface ItineraryQueryLocationOverride {
  type: Exclude<TransportMode, "FOOT"> | TBMEndpoints.Addresses;
}

type ItineraryQueryLocation = Extract<ItineraryQuery, { from: unknown; to: unknown }>["from"];

type Location = Omit<ItineraryQueryLocation, keyof ItineraryQueryLocationOverride> &
  ItineraryQueryLocationOverride;

const defaultLocation = {
  id: -1 as const,
  type: "Addresses" as TBMEndpoints.Addresses,
  coords: [-1, -1] satisfies [unknown, unknown],
  alias: "" as const,
} satisfies Location;

function normalizeLocationForQuery(loc: Location): ItineraryQueryLocation {
  return {
    ...loc,
    type:
      loc.type === "BATEAU" || loc.type === "BUS" || loc.type === "TRAM"
        ? ("TBM_Stops" as TBMEndpoints.Stops)
        : loc.type === "TRAIN"
          ? ("SNCF_Stops" as SNCFEndpoints.Stops)
          : ("Addresses" as TBMEndpoints.Addresses),
  };
}

type colorTransports = "walking" | "tbm" | "sncf";
type colorComm = "info" | "alert" | "success";
type colorType = "bg" | "t";
type colorPalette<Base extends string> = `${Base}-${colorType}`;

export {
  toggleDarkMode,
  theme,
  client,
  APIRefresh,
  defaultQuerySettings,
  defaultLocation,
  normalizeLocationForQuery,
};
export type { QuerySettings, colorTransports, colorComm, colorPalette, Location };

export {
  formatDate,
  transportToIcon,
  transportToType,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  parseJSON,
  getNewTopZIndex,
} from "./utils";
export type {
  TransportIcon,
  TransportMode,
  TransportProvider,
  UnknownIcon,
  UnknownLiteral,
  Obj,
} from "./utils";
