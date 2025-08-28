import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import SNCF_Schedules, {
  dbSNCF_Schedules,
  SNCF_ScheduleFreshness,
} from "@bibm/data/models/SNCF/SNCF_schedules.model";
import { Application } from "../../../declarations";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint } from "../../endpoint";
import { SNCF_Admin, SNCF_Coords, SNCF_Link, SNCF_Stop, SNCF_StopArea } from "./SNCF_Stops.endpoint";

interface SNCF_Poi {
  id: string; // Identifier of the poi
  name: string; // Name of the poi
  label: string; // Label of the poi. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label.
  poi_type: {
    id: string; // Identifier of the poi type
    name: string; // Name of the poi type
  }; // Type of the poi
  /** Information on the spots available, for BSS stations */
  stands: {
    available_places: number; // Number of places where one can park
    available_bikes: number; // Number of bikes available
    total_stands: number; // Total number of stands (occupied or not, with or without special equipment)
    /**
     * Information about the station itself:
     * unavailable: Navitia is not able to obtain information about the station
     * open: The station is open
     * closed: The station is closed
     */
    status: "unavailable" | "open" | "closed";
  };
}

interface SNCF_Address {
  id: string; // Identifier of the address
  name: string; // Name of the address
  label: string; // Label of the address. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label.
  coord: SNCF_Coords; // Coordinates of the address
  house_number: number; // House number of the address
  administrative_regions: SNCF_Admin[]; // Administrative regions of the address in which is the stop area
}

enum SNCF_Place_Type {
  administrative_region, // a city, a district, a neighborhood
  stop_area, // a nameable zone, where there are some stop points
  stop_point, // a location where vehicles can pickup or drop off passengers
  address, // a point located in a street
  poi, // a point of interest
}

/** https://doc.navitia.io/#place */
type SNCF_Place<T extends SNCF_Place_Type> = {
  id: string; // The id of the embedded object
  name: string; // The name of the embedded object
  quality: number; // The quality of the place
  embedded_type: T; // The type of the embedded object
} & (T extends SNCF_Place_Type.address
  ? { address: SNCF_Address }
  : T extends SNCF_Place_Type.administrative_region
    ? { administrative_region: SNCF_Admin }
    : T extends SNCF_Place_Type.poi
      ? { poi: SNCF_Poi }
      : T extends SNCF_Place_Type.stop_area
        ? { stop_area: SNCF_StopArea }
        : T extends SNCF_Place_Type.stop_point
          ? { stop_point: SNCF_Stop }
          : never);

interface SNCF_Route {
  id: string;
  name: string;
  direction: SNCF_Place<SNCF_Place_Type>;
  direction_type?: "forward" | "backward";
  is_frequence: "False" | "True";
  line: SNCF_Line;
  links?: SNCF_Link[];
}

interface SNCF_CommercialMode {
  id: string; // Identifier of the commercial mode
  name: string; // Name of the commercial mode
  physical_modes: SNCF_PhysicalMode[]; //Physical modes of this commercial mode
}

type SNCF_PhysicalModeId =
  | "Air"
  | "Boat"
  | "Bus"
  | "BusRapidTransit"
  | "Coach"
  | "Ferry"
  | "Funicular"
  | "LocalTrain"
  | "LongDistanceTrain"
  | "Metro"
  | "RailShuttle"
  | "RapidTransit"
  | "Shuttle"
  | "SuspendedCableCar"
  | "Taxi"
  | "Train"
  | "Tramway";

interface SNCF_PhysicalMode {
  id: `physical_mode:${SNCF_PhysicalModeId}`; // Identifier of the physical mode
  name: string; // Name of the physical mode
  commercial_modes: SNCF_CommercialMode[]; // Commercial modes of this physical mode
}

interface SNCF_Line {
  id: string; // Identifier of the line
  name: string; // Name of the line
  code: string; // Code name of the line
  color: string; // Color of the line
  opening_time: string; // Opening hour at format HHMMSS
  closing_time: string; // Closing hour at format HHMMSS
  routes: SNCF_Route[]; // Routes of the line
  commercial_mode: SNCF_CommercialMode; // Commercial mode of the line
  physical_modes: SNCF_PhysicalMode[]; // Physical modes of the line
}

interface SNCF_StopDateTime {
  display_informations: {
    code: string;
    color: string;
    commercial_mode: string;
    direction: string;
    label: string;
    links: SNCF_Link[];
    name: string;
    network: string;
    text_color: string;
    trip_short_name: string;
  };
  stop_point: SNCF_Stop;
  route: SNCF_Route;
  stop_date_time: {
    additional_informations: string[];
    // Does not correspond to API doc!
    data_freshness: "realtime" | "base_schedule";
    // iso-date-times
    base_arrival_date_time: string;
    arrival_date_time: string;
    base_departure_date_time: string;
    departure_date_time: string;
    links: SNCF_Link[];
  };
}

/**
 * Parse SNCF API date
 * It's ISO 8601 but without the '-' and ':' and with a 'T' between date and time, not supported by `new Date()`
 * @param {String} string
 * @returns {Date}
 */
function parseSNCFdate(string: string): Date {
  const date = new Date(0);
  date.setFullYear(
    parseInt(string.substring(0, 4)),
    parseInt(string.substring(4, 6)) - 1,
    parseInt(string.substring(6, 8)),
  );
  date.setHours(parseInt(string.substring(9, 11)), parseInt(string.substring(11, 13)));

  return date;
}

function SNCFStopDateTimeToDBSchedule(stopDateTime: SNCF_StopDateTime): dbSNCF_Schedules {
  const tripId = parseInt(stopDateTime.display_informations.trip_short_name);
  if (isNaN(tripId)) throw new Error("Invalid tripId");
  const stopId = parseInt(stopDateTime.stop_point.id.substring(16, 24));
  if (isNaN(stopId)) throw new Error("Invalid stopId");

  const id = `${tripId}:${stopId}`;

  return {
    _id: id,
    arrival: parseSNCFdate(stopDateTime.stop_date_time.arrival_date_time),
    departure: parseSNCFdate(stopDateTime.stop_date_time.departure_date_time),
    freshness:
      stopDateTime.stop_date_time.data_freshness === "realtime"
        ? SNCF_ScheduleFreshness.Realtime
        : SNCF_ScheduleFreshness.Base,
    trip: tripId,
    stop: stopId,
    route: stopDateTime.route.id,
  };
}

export default async (
  app: Application,
  getData: <T>(
    paths: Record<string, string>,
    feature: string,
    queries?: Record<string, string | number>,
  ) => Promise<T>,
) => {
  const Schedules = SNCF_Schedules(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      SNCFEndpoints.Schedules,
      20,
      async () => {
        // API Doc: https://doc.navitia.io/#stop-schedules
        const date = new Date().toISOString();
        const stopDepartures = (
          await getData<{ departures: SNCF_StopDateTime[] }>(
            {
              coverage: "sncf",
              coord: "-0.61439;44.82321", //middle of BM
            },
            "departures",
            {
              distance: 20000, // 20 km
              count: 10_000, // Get everything, no paging
              from_datetime: date,
              data_freshness: "realtime",
              disable_geojson: JSON.stringify(true),
            },
          )
        ).departures;
        const stopArrivals = (
          await getData<{ arrivals: SNCF_StopDateTime[] }>(
            {
              coverage: "sncf",
              coord: "-0.61439;44.82321", //middle of BM
            },
            "arrivals",
            {
              distance: 20000, // 20 km
              count: 10_000, // Get everything, no paging
              from_datetime: date,
              data_freshness: "realtime",
              disable_geojson: JSON.stringify(true),
            },
          )
        ).arrivals;

        const schedules: dbSNCF_Schedules[] = new Map(
          stopDepartures
            .map((stopDeparture) => {
              const schedule = SNCFStopDateTimeToDBSchedule(stopDeparture);
              return [schedule._id, schedule] as const;
            })
            .concat(
              stopArrivals.map((stopArrival) => {
                const schedule = SNCFStopDateTimeToDBSchedule(stopArrival);
                return [schedule._id, schedule] as const;
              }),
            ),
        )
          .values()
          .toArray();

        await bulkUpsertAndPurge(Schedules, schedules, ["_id"]);

        return true;
      },
      Schedules,
    ).init(),
  ] as const;
};
