import { Coords } from "@bibm/common/geographics";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Intersections, { dbIntersections } from "@bibm/data/models/TBM/intersections.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint } from "../../endpoint";

export type Intersection = BaseTBM<{
  gid: string;
  nature: string;
}> & {
  geometry: { coordinates: Coords };
};

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Intersection = TBM_Intersections(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Intersections,
      24 * 3600,
      async () => {
        const rawIntersections: Intersection[] = await getData("fv_carre_p", ["crs=epsg:2154"]);

        const intersections: dbIntersections[] = rawIntersections.map((intersection) => {
          return {
            coords: intersection.geometry.coordinates,
            _id: parseInt(intersection.properties.gid),
            nature: intersection.properties.nature,
          };
        });

        await bulkUpsertAndPurge(Intersection, intersections, ["_id"]);

        return true;
      },
      Intersection,
    ).init(),
  ] as const;
};
