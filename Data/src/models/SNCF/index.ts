import { dbSNCF_Schedules, dbSNCF_SchedulesModel } from "./SNCF_schedules.model";
import { dbSNCF_Stops, dbSNCF_StopsModel } from "./SNCF_stops.model";

enum SNCFEndpoints {
  Schedules = "SNCF_Schedules",
  Stops = "SNCF_Stops",
}

type SNCFClass<E extends SNCFEndpoints | undefined = undefined> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_Schedules
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_Stops
    : dbSNCF_Schedules | dbSNCF_Stops;

type SNCFModel<E extends SNCFEndpoints | undefined = undefined> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_SchedulesModel
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_StopsModel
    : dbSNCF_SchedulesModel | dbSNCF_StopsModel;

export { SNCFEndpoints };
export type { SNCFClass, SNCFModel };
