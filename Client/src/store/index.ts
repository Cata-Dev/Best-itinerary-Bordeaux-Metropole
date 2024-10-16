import type { TBMEndpoints } from "server/externalAPIs/TBM/index";
import type { ItineraryQuery } from "server";
import { theme, toggleDarkMode } from "./theme/theme";
import { client, APIRefresh } from "./feathers/feathers";
import type { TransportMode, TransportProvider } from "./utils";

interface QuerySettings {
  departureTime: string;
  maxWalkDistance: number;
  walkSpeed: number;
  transports: Partial<Record<TransportProvider, boolean>>;
}

const defaultQuerySettings: QuerySettings = {
  departureTime: "",
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

type Location = Omit<ItineraryQuery["from"], keyof ItineraryQueryLocationOverride> &
  ItineraryQueryLocationOverride;

const defaultLocation = {
  id: -1 as const,
  type: "Addresses" as TBMEndpoints.Addresses,
  coords: [-1, -1] satisfies [unknown, unknown],
  alias: "" as const,
} satisfies Location;

type colorTransports = "walking" | "tbm" | "sncf";
type colorComm = "info" | "alert" | "success";
type colorType = "bg" | "t";
type colorPalette<Base extends string> = `${Base}-${colorType}`;

export { toggleDarkMode, theme, client, APIRefresh, defaultQuerySettings, defaultLocation };
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
  UnknowIcon,
  UnknowLitteral,
  Obj,
} from "./utils";
