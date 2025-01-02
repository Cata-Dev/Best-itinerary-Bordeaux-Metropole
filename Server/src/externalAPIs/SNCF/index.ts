import { SNCFEndpoints } from "data/lib/models/SNCF/names";

import axios from "axios";
import { unique } from "common/filters";
import { WGSToLambert93 } from "common/geographics";
import SNCF_Schedules, {
  dbSNCF_Schedules,
  dbSNCF_SchedulesModel,
} from "data/lib/models/SNCF/SNCF_schedules.model";
import SNCF_Stops, { dbSNCF_Stops, dbSNCF_StopsModel } from "data/lib/models/SNCF/SNCF_stops.model";
import { Application } from "../../declarations";
import { logger } from "../../logger";
import { bulkOps } from "../../utils";
import { Endpoint } from "../endpoint";

/**
 * Parse SNCF API date
 * @param {String} string
 * @returns {Date}
 */
function parseSNCFdate(string: string): Date {
  const date = new Date();
  date.setFullYear(
    parseInt(string.substring(0, 4)),
    parseInt(string.substring(4, 6)) - 1,
    parseInt(string.substring(6, 8)),
  );
  date.setHours(parseInt(string.substring(9, 11)), parseInt(string.substring(11, 13)));
  return date;
}

function pad(number: number) {
  let s = String(number);
  if (s.length === 1) {
    s = "0" + s;
  }
  return s;
}

/**
 * Format SNCF API date
 * @param {Date} date
 * @returns {String}
 */
function formatSNCFdate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}T${date.getHours()}${date.getMinutes()}00`;
}

declare module "../../declarations" {
  interface ExternalAPIs {
    SNCF: { endpoints: { [EN in SNCFEndpoints]: Endpoint<EN> } };
  }
}

export type SNCFClass<E extends SNCFEndpoints | undefined = undefined> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_Schedules
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_Stops
    : dbSNCF_Schedules | dbSNCF_Stops;

export type SNCFModel<E extends SNCFEndpoints | undefined = undefined> = E extends SNCFEndpoints.Schedules
  ? dbSNCF_SchedulesModel
  : E extends SNCFEndpoints.Stops
    ? dbSNCF_StopsModel
    : dbSNCF_SchedulesModel | dbSNCF_StopsModel;

interface SNCF_link {
  id: string;
  type: string;
}

interface SNCF_Schedule {
  display_informations: {
    code: string;
    color: string;
    commercial_mode: string;
    direction: string;
    label: string;
    links: SNCF_link[];
    name: string;
    network: string;
    text_color: string;
  };
  table: {
    headers: {
      additional_informations: string[];
      display_informations: {
        code: string;
        color: string;
        commercial_mode: string;
        description: string;
        direction: string;
        equipments: unknown[];
        headsign: number;
        links: SNCF_link[];
        name: string;
        network: string;
        physical_mode: string;
        text_color: string;
        trip_short_name: string;
      };
      links: SNCF_link[];
    }[];
    rows: {
      date_times: {
        additional_informations: string[];
        data_freshness: string | null;
        date_time: string;
        links: SNCF_link[];
      }[];
      stop_point: SNCF_Stop;
    }[];
  };
}

interface SNCF_Stop {
  coord: {
    lat: string;
    lon: string;
  };
  equipments: unknown[];
  id: string;
  label: string;
  links: SNCF_link[];
  name: string;
}

export default (app: Application) => {
  logger.log(`Initializing SNCF models...`);

  const Schedule = SNCF_Schedules(app.get("sourceDBConn"));
  const Stop = SNCF_Stops(app.get("sourceDBConn"));

  logger.info(`Models initialized.`);

  /**
   * Fetch data from SNCF API
   * @param {Array} paths
   * @param {Array} feature
   * @param {Array} queries
   */
  async function getData<T>(
    paths: Record<string, string>,
    feature: string,
    queries: Record<string, string | number> = {},
  ): Promise<T> {
    const bURL = "https://api.sncf.com/v1";
    const url = `/${Object.keys(paths)
      .map((k) => `${k}/${paths[k]}`)
      .join("/")}/${feature}?key=${app.get("server").SNCFkey}&${Object.keys(queries)
      .map((k) => `${k}=${queries[k]}`)
      .join("&")}`;
    const { data }: { data: T } = await axios.get(`${bURL}${url}`);
    return data;
  }

  app.externalAPIs.SNCF = {
    endpoints: {
      [SNCFEndpoints.Schedules]: new Endpoint(
        SNCFEndpoints.Schedules,
        20,
        async () => {
          const date = formatSNCFdate(new Date());
          const route_schedules = (
            await getData<{ route_schedules: SNCF_Schedule[] }>(
              {
                coverage: "sncf",
                coord: "-0.61439;44.82321", //middle of BM
              },
              "route_schedules",
              {
                distance: 15000, //15km
                count: 500,
                depth: 0,
                data_freshness: "realtime",
                since: date,
              },
            )
          ).route_schedules;

          const schedules: dbSNCF_Schedules[] = [];
          for (const route_schedule of route_schedules) {
            route_schedule.table.rows.forEach((row) => {
              //iterate through rows of schedules table
              const stop_point = parseInt(row.stop_point.id.substring(16, 24));
              row.date_times.forEach((schedule, j) => {
                //now iterate through columns
                if (!schedule.data_freshness) return; //empty cell in schedules table
                const header = route_schedule.table.headers[j]; //header of the actual column
                const route = `${route_schedule.display_informations.name}:${header.display_informations.direction}`;
                const trip = parseInt(header.display_informations.trip_short_name);
                schedules.push({
                  _id: `${trip}:${stop_point}`, //equals to 'j:i', 'column:row'
                  realtime: parseSNCFdate(schedule.date_time),
                  trip,
                  stop_point,
                  route,
                });
              });
            });
          }

          await Schedule.deleteMany({
            _id: { $nin: schedules.map((s) => s._id) },
          });
          await Schedule.bulkWrite(
            bulkOps("updateOne", schedules as unknown as Record<keyof dbSNCF_Schedules, unknown>[]),
          );

          return true;
        },
        Schedule,
      ),

      [SNCFEndpoints.Stops]: new Endpoint(
        SNCFEndpoints.Stops,
        24 * 3600,
        async () => {
          const rawStops = (
            await getData<{ stop_points: SNCF_Stop[] }>(
              {
                coverage: "sncf",
                coord: "-0.61439;44.82321", //middle of BM
              },
              "stop_points",
              {
                distance: 15000, //15km
                count: 500,
                depth: 0,
              },
            )
          ).stop_points;

          const Stops: dbSNCF_Stops[] = rawStops
            .map((stop) => {
              return {
                _id: parseInt(stop.id.substring(16, 24)),
                coords: WGSToLambert93(parseFloat(stop.coord.lat), parseFloat(stop.coord.lon)),
                name: stop.name,
                name_lowercase: stop.name.toLowerCase(),
              };
            })
            .filter(unique);

          await Stop.deleteMany({ _id: { $nin: Stops.map((s) => s._id) } });
          await Stop.bulkWrite(
            bulkOps("updateOne", Stops as unknown as Record<keyof dbSNCF_Stops, unknown>[]),
          );

          return true;
        },
        Stop,
      ),
    },
  };

  app.externalAPIs.endpoints = { ...app.externalAPIs.endpoints, ...app.externalAPIs.SNCF };
};
