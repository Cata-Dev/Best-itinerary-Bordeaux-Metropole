import { unique } from "@bibm/common/filters";
import { WGSToLambert93 } from "@bibm/common/geographics";
import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import SNCF_Stops, { dbSNCF_Stops } from "@bibm/data/models/SNCF/SNCF_stops.model";
import { normalize } from "path";
import { Application } from "../../../declarations";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint, parallelHooksConstructor, sequenceHooksConstructor } from "../../endpoint";
import { makeNSRHook } from "../../TBM/endpoints/sections.endpoint";
import { makeSNCFSRHook } from "./SNCFScheduledRoutes.endpoint";

interface SNCF_Link {
  id: string;
  type: string;
}

interface SNCF_Coords {
  lat: string;
  lon: string;
}

interface SNCF_Admin {
  id: string; // Identifier of the address
  name: string; // Name of the address
  label: string; // Label of the administrative region. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label.
  coord: SNCF_Coords; // Coordinates of the address
  level: number; // Level of the admin
  zip_code: string; // Zip code of the admin
}

interface SNCF_Stop {
  id: string;
  name: string;
  coord: SNCF_Coords;
  equipments: unknown[];
  stop_area: SNCF_StopArea;
}

interface SNCF_StopArea {
  id: string; // Identifier of the stop area
  name: string; // Name of the stop area
  label: string; // Label of the stop area. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label.
  coord: SNCF_Coords; // Coordinates of the stop area
  administrative_regions: SNCF_Admin[]; // Administrative regions of the stop area in which is the stop area
  stop_points: SNCF_Stop[]; // Stop points contained in this stop area
}

export default async (
  app: Application,
  getData: <T>(
    paths: Record<string, string>,
    feature: string,
    queries?: Record<string, string | number>,
  ) => Promise<T>,
) => {
  const Stops = SNCF_Stops(app.get("sourceDBConn"));

  return [
    await new Endpoint(
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
              distance: 20000, // 20 km
              count: 100, // Get everything, no paging
              depth: 0,
            },
          )
        ).stop_points;

        const stops: dbSNCF_Stops[] = rawStops
          .map((stop) => {
            return {
              _id: parseInt(stop.id.substring(16, 24)),
              coords: WGSToLambert93(parseFloat(stop.coord.lat), parseFloat(stop.coord.lon)),
              name: stop.name,
              name_norm: normalize(stop.name),
            };
          })
          .filter(unique);

        await bulkUpsertAndPurge(Stops, stops, ["_id"]);

        return true;
      },
      Stops,
    )
      .registerHook(
        sequenceHooksConstructor(
          () => () => app.get("computeInstance").refreshData(["compute", "computePTN"]),
          parallelHooksConstructor(
            makeSNCFSRHook(app, SNCFEndpoints.Stops),
            makeNSRHook(app, SNCFEndpoints.Stops),
          ),
        ),
      )
      .init(),
  ] as const;
};

export type { SNCF_Admin, SNCF_Coords, SNCF_Link, SNCF_Stop, SNCF_StopArea };
