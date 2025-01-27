import { Coords } from "@bibm/common/geographics";
import { normalize } from "@bibm/common/string";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Stops, { Active, dbTBM_Stops, StopType, VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";
import { makeNSRHook } from "./sections.endpoint";
import { makeSRHook } from "./TBMScheduledRoutes.endpoint";

export type TBM_Stop = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  type: StopType;
  actif: Active;
}> & {
  geometry: { coordinates: Coords };
};

export default async (app: Application, getData: <T>(id: string, queries: string[]) => Promise<T>) => {
  const Stop = TBM_Stops(app.get("sourceDBConn"));

  return [
    await new Endpoint(
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

        const bulked = await Stop.bulkWrite(
          bulkOps("updateOne", Stops as unknown as Record<keyof dbTBM_Stops, unknown>[]),
        );
        await Stop.deleteMany({
          _id: { $nin: Object.values(bulked.upsertedIds).concat(Object.values(bulked.insertedIds)) },
        });

        return true;
      },
      Stop,
    )
      .registerHook(makeNSRHook(app, TBMEndpoints.Stops), makeSRHook(app, TBMEndpoints.Stops), () =>
        app.get("computeInstance").refreshData(["compute", "computePTN"]),
      )
      .init(),
  ] as const;
};
