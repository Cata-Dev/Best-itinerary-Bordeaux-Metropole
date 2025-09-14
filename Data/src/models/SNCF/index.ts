import { dbSNCF_Schedules, dbSNCF_SchedulesModel } from "./SNCF_schedules.model";
import { dbSNCF_Stops, dbSNCF_StopsModel } from "./SNCF_stops.model";
import { dbSNCF_ScheduledRoutes, dbSNCF_ScheduledRoutesModel } from "./SNCFScheduledRoutes.model";

enum SNCFEndpoints {
  Schedules = "SNCF_Schedules",
  Stops = "SNCF_Stops",
  ScheduledRoutes = "SNCF_Scheduled_routes",
}

type SNCFClass<E extends SNCFEndpoints = SNCFEndpoints> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_Schedules
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_Stops
    : E extends SNCFEndpoints.ScheduledRoutes
      ? dbSNCF_ScheduledRoutes
      : never;

type SNCFModel<E extends SNCFEndpoints = SNCFEndpoints> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_SchedulesModel
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_StopsModel
    : E extends SNCFEndpoints.ScheduledRoutes
      ? dbSNCF_ScheduledRoutesModel
      : never;

export { SNCFEndpoints };
export type { SNCFClass, SNCFModel };
