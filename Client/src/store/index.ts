import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import type { JourneyQuery } from "@bibm/server";
import { APIRefresh, client } from "./feathers/feathers";
import { theme, toggleDarkMode } from "./theme/theme";
import { formatDateToInput, type TransportMode, type TransportProvider } from "./utils";

interface QuerySettings {
  departureTime: string;
  maxWalkDistance: number;
  walkSpeed: number;
  transports: Partial<Record<TransportProvider, boolean>>;
}

const defaultQuerySettings: QuerySettings = {
  departureTime: formatDateToInput(new Date()),
  maxWalkDistance: 1000,
  walkSpeed: 3.6,
  transports: {
    TBM: true,
    SNCF: true,
  },
};

interface JourneyQueryLocationOverride {
  type: Exclude<TransportMode, "FOOT"> | TBMEndpoints.Addresses;
}

type JourneyQueryLocation = Extract<JourneyQuery, { from: unknown; to: unknown }>["from"];

type Location = Omit<JourneyQueryLocation, keyof JourneyQueryLocationOverride> & JourneyQueryLocationOverride;

const defaultLocation = {
  id: -1 as const,
  type: TBMEndpoints.Addresses,
  coords: [-1, -1] satisfies [unknown, unknown],
  alias: "" as const,
} satisfies Location;

function normalizeLocationForQuery(loc: Location): JourneyQueryLocation {
  return {
    ...loc,
    type:
      loc.type === "BATEAU" || loc.type === "BUS" || loc.type === "TRAM"
        ? TBMEndpoints.Stops
        : loc.type === "TRAIN"
          ? SNCFEndpoints.Stops
          : TBMEndpoints.Addresses,
  };
}

type colorTransports = "walking" | "tbm" | "sncf";
type colorComm = "info" | "alert" | "success";
type colorType = "bg" | "t";
type colorPalette<Base extends string> = `${Base}-${colorType}`;

export {
  APIRefresh,
  client,
  defaultLocation,
  defaultQuerySettings,
  normalizeLocationForQuery,
  theme,
  toggleDarkMode,
};
export type { colorComm, colorPalette, colorTransports, Location, QuerySettings };

export * from "./utils";
export type {
  Obj,
  TransportIcon,
  TransportMode,
  TransportProvider,
  UnknownIcon,
  UnknownLiteral,
} from "./utils";
