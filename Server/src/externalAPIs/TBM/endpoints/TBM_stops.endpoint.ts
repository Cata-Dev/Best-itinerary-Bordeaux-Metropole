import { Coords } from "@bibm/common/geographics";
import { normalize } from "@bibm/common/string";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Stops, { Active, dbTBM_Stops, StopType, VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint, parallelHooksConstructor, sequenceHooksConstructor } from "../../endpoint";
import { makeNSRHook } from "./sections.endpoint";
import { makeTBMSRHook } from "./TBMScheduledRoutes.endpoint";

export type TBM_Stop = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  type: StopType;
  actif: Active;
}> & {
  geometry: { coordinates: Coords };
};

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Stop = TBM_Stops(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Stops,
      24 * 3600,
      async () => {
        const rawStops: TBM_Stop[] = await getData("sv_arret_p", ["crs=epsg:2154"]);

        const stops: dbTBM_Stops[] = rawStops.map((stop) => {
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

        await bulkUpsertAndPurge(Stop, stops, ["_id"]);

        return true;
      },
      Stop,
    )
      .registerHook(
        sequenceHooksConstructor(
          () => () => app.get("computeInstance").refreshData(["compute", "computePTN"]),
          parallelHooksConstructor(
            makeTBMSRHook(app, TBMEndpoints.Stops),
            makeNSRHook(app, TBMEndpoints.Stops),
          ),
        ),
      )
      .init(),
  ] as const;
};
