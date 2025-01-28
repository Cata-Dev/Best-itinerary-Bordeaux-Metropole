import { Coords } from "@bibm/common/geographics";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_RouteSections, { dbTBM_RouteSections } from "@bibm/data/models/TBM/TBM_route_sections.model";
import { VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";

export type TBM_RouteSections = BaseTBM<{
  gid: string;
  vehicule: VehicleType;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
}> & {
  geometry: { coordinates: Coords[] };
};

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const RouteSection = TBM_RouteSections(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.RouteSections,
      5 * 60,
      async () => {
        const rawRouteSections: TBM_RouteSections[] = await getData("sv_tronc_l", ["crs=epsg:2154"]);

        const routeSections: dbTBM_RouteSections[] = rawRouteSections.map((routeSection) => {
          return {
            _id: parseInt(routeSection.properties.gid),
            coords: routeSection.geometry.coordinates,
            vehicule: routeSection.properties.vehicule,
            rg_sv_arret_p_nd: routeSection.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: routeSection.properties.rg_sv_arret_p_na,
          };
        });

        const bulked = await RouteSection.bulkWrite(
          bulkOps("updateOne", routeSections as unknown as Record<keyof dbTBM_RouteSections, unknown>[]),
        );
        await RouteSection.deleteMany({
          _id: { $nin: Object.values(bulked.upsertedIds).concat(Object.values(bulked.insertedIds)) },
        });

        return true;
      },
      RouteSection,
    ).init(),
  ] as const;
};
