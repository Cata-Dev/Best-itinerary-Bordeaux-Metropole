import { theme, toggleDarkMode } from "./theme/theme";
import { client, APIRefresh } from "./feathers/feathers";
import {
  duration,
  formatDate,
  transportToIcon,
  transportToType,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  parseJSON,
} from "./utils";
import type {
  TransportIcon,
  TransportMode,
  TransportProvider,
  UnknowIcon,
  UnknowLitteral,
  Obj,
} from "./utils";

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

export {
  toggleDarkMode,
  theme,
  client,
  APIRefresh,
  duration,
  formatDate,
  transportToIcon,
  transportToType,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  parseJSON,
  defaultQuerySettings,
};

export type {
  TransportIcon,
  TransportMode,
  TransportProvider,
  UnknowIcon,
  UnknowLitteral,
  Obj,
  QuerySettings,
};
