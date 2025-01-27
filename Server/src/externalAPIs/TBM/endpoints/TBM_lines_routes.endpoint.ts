import TBM_Lines_routes, { dbTBM_Lines_routes } from "@bibm/data/models/TBM/TBM_lines_routes.model";
import { VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";
import { makeSRHook } from "./TBMScheduledRoutes.endpoint";

export type TBM_Lines_route = BaseTBM<{
  gid: string;
  libelle: string;
  sens: string;
  vehicule: VehicleType;
  rs_sv_ligne_a: number;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
}>;

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const LinesRoute = TBM_Lines_routes(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Lines_routes,
      3600,
      async () => {
        const rawLines_routes: TBM_Lines_route[] = await getData("sv_chem_l", [
          "attributes=" +
            JSON.stringify([
              "gid",
              "libelle",
              "sens",
              "vehicule",
              "rs_sv_ligne_a",
              "rg_sv_arret_p_nd",
              "rg_sv_arret_p_na",
            ]),
        ]);

        const Lines_routes: dbTBM_Lines_routes[] = rawLines_routes.map((lines_route) => {
          return {
            _id: parseInt(lines_route.properties.gid),
            libelle: lines_route.properties.libelle,
            sens: lines_route.properties.sens,
            vehicule: lines_route.properties.vehicule,
            rs_sv_ligne_a: lines_route.properties.rs_sv_ligne_a,
            rg_sv_arret_p_nd: lines_route.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: lines_route.properties.rg_sv_arret_p_na,
          };
        });

        const bulked = await LinesRoute.bulkWrite(
          bulkOps("updateOne", Lines_routes as unknown as Record<keyof dbTBM_Lines_routes, unknown>[]),
        );
        await LinesRoute.deleteMany({
          _id: { $nin: Object.values(bulked.upsertedIds).concat(Object.values(bulked.insertedIds)) },
        });

        return true;
      },
      LinesRoute,
    )
      .registerHook(makeSRHook(app, TBMEndpoints.Lines_routes))
      .init(),
  ] as const;
};
