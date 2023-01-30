import { theme, toggleDarkMode } from "./theme/theme";
import { client, APIRefresh } from "./feathers/feathers";
import type { TransportProvider } from "./utils";

interface QuerySettings {
  departureTime: string;
  maxWalkDistance: number;
  walkSpeed: number;
  transports: Partial<Record<TransportProvider, boolean>>;
}

const defaultQuerySettings: QuerySettings = {
  departureTime: "",
  maxWalkDistance: 1000,
  walkSpeed: 6.0,
  transports: {
    TBM: true,
    SNCF: true,
  },
};

const defaultLocation = {
  display: "" as const,
  type: "ADRESSE" as const,
  value: [0, 0] as const,
};

type DefaultLocation = typeof defaultLocation;

type colorTransports = "walking" | "tbm" | "sncf";
type colorComm = "info" | "alert" | "success";
type colorType = "bg" | "t";
type colorPalette<Base extends string> = `${Base}-${colorType}`;

export { toggleDarkMode, theme, client, APIRefresh, defaultQuerySettings, defaultLocation };
export type { QuerySettings, DefaultLocation, colorTransports, colorComm, colorPalette };

export {
  duration,
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
