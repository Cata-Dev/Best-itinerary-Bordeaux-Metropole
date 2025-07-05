import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Trips, { dbTBM_Trips } from "@bibm/data/models/TBM/TBM_trips.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint } from "../../endpoint";
import { makeSRHook } from "./TBMScheduledRoutes.endpoint";

export type TBM_Trip = BaseTBM<{
  gid: string;
  etat: string;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
  rs_sv_ligne_a: number;
  rs_sv_chem_l: number;
}>;

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Trip = TBM_Trips(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Trips,
      // 60s in reality but it's of no use to be that precise because data treatment takes way more time...
      3 * 60,
      async () => {
        const rawTrips: TBM_Trip[] = await getData("sv_cours_a", [
          "filter=" +
            JSON.stringify({
              etat: {
                $in: ["NON_COMMENCE", "EN_COURS"],
              },
            }),
        ]);
        if (app.get("debug")) logger.debug(`Fetched ${rawTrips.length} trips`);

        const trips: dbTBM_Trips[] = rawTrips.map((trip) => {
          return {
            _id: parseInt(trip.properties.gid),
            etat: trip.properties.etat,
            rg_sv_arret_p_nd: trip.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: trip.properties.rg_sv_arret_p_na,
            rs_sv_ligne_a: trip.properties.rs_sv_ligne_a,
            rs_sv_chem_l: trip.properties.rs_sv_chem_l,
          };
        });

        const [bulked, { deletedCount }] = await bulkUpsertAndPurge(Trip, trips, ["_id"]);
        if (app.get("debug"))
          logger.debug(
            `Trips: updated ${bulked.upsertedCount}, inserted ${bulked.insertedCount} and deleted ${deletedCount}`,
          );

        return true;
      },
      Trip,
    )
      .registerHook(makeSRHook(app, TBMEndpoints.Trips))
      .init(),
  ] as const;
};
