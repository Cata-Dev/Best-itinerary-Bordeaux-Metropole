import { TBMEndpoints } from "data/lib/models/TBM/names";
import TBM_Trips, { dbTBM_Trips } from "data/lib/models/TBM/TBM_trips.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";

export type TBM_Vehicle = BaseTBM<{
  gid: string;
  etat: string;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
  rs_sv_ligne_a: number;
  rs_sv_chem_l: number;
}>;

export default (app: Application, getData: <T>(id: string, queries: string[]) => Promise<T>) => {
  const Trip = TBM_Trips(app.get("sourceDBConn"));

  return [
    new Endpoint(
      TBMEndpoints.Trips,
      10 * 60,
      async () => {
        const rawTrips: TBM_Vehicle[] = await getData("sv_cours_a", [
          "filter=" +
            JSON.stringify({
              etat: {
                $in: ["NON_COMMENCE", "EN_COURS"],
              },
            }),
        ]);

        const Trips: dbTBM_Trips[] = rawTrips.map((trip) => {
          return {
            _id: parseInt(trip.properties.gid),
            etat: trip.properties.etat,
            rg_sv_arret_p_nd: trip.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: trip.properties.rg_sv_arret_p_na,
            rs_sv_ligne_a: trip.properties.rs_sv_ligne_a,
            rs_sv_chem_l: trip.properties.rs_sv_chem_l,
          };
        });

        await Trip.deleteMany({
          _id: { $nin: Trips.map((v) => v._id) },
        });
        await Trip.bulkWrite(bulkOps("updateOne", Trips as unknown as Record<keyof dbTBM_Trips, unknown>[]));

        return true;
      },
      Trip,
    ),
  ] as const;
};
