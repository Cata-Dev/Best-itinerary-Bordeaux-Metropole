import { normalize } from "common/string";
import { TBMEndpoints } from "data/models/TBM/index";
import TBM_Stops, { Active, dbTBM_Stops, StopType, VehicleType } from "data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";

export type TBM_Stop = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  type: StopType;
  actif: Active;
}> & {
  geometry: { coordinates: [number, number] };
};

export default (app: Application, getData: <T>(id: string, queries: string[]) => Promise<T>) => {
  const Stop = TBM_Stops(app.get("sourceDBConn"));

  return [
    new Endpoint(
      TBMEndpoints.Stops,
      24 * 3600,
      async () => {
        const rawStops: TBM_Stop[] = await getData("sv_arret_p", ["crs=epsg:2154"]);

        const Stops: dbTBM_Stops[] = rawStops.map((stop) => {
          return {
            coords: stop.geometry?.coordinates ?? [Infinity, Infinity], //out of BM
            _id: parseInt(stop.properties.gid),
            libelle: stop.properties.libelle,
            libelle_norm: normalize(stop.properties.libelle),
            vehicule: stop.properties.vehicule,
            type: stop.properties.type,
            actif: stop.properties.actif,
          };
        });

        await Stop.deleteMany({ _id: { $nin: Stops.map((s) => s._id) } });
        await Stop.bulkWrite(bulkOps("updateOne", Stops as unknown as Record<keyof dbTBM_Stops, unknown>[]));

        return true;
      },
      Stop,
    ).on("fetched", (success) => {
      if (!success) return;
      // Let it handle starting computing - wait for most fresh data
      if (app.externalAPIs.TBM.endpoints[TBMEndpoints.Sections].fetching === true) return;

      app
        .get("computeInstance")
        .app.queues[3].add("computeNSR", [5e3])
        .catch((err) => logger.error("Failed to start computing Non Schedules Routes", err));
    }),
  ] as const;
};
