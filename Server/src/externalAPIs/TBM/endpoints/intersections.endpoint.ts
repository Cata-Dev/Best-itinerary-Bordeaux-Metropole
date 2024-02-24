import { BaseTBM, TBMEndpoints } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";
import TBM_Intersections, { dbIntersections } from "data/lib/models/TBM/intersections.model";

export type Intersection = BaseTBM<{
  gid: string;
  nature: string;
}> & {
  geometry: { coordinates: [number, number] };
};

export default (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Intersection = TBM_Intersections(app.get("mongooseClient"));

  return [
    new Endpoint(
      TBMEndpoints.Intersections,
      24 * 3600,
      async () => {
        const rawIntersections: Intersection[] = await getData("fv_carre_p", ["crs=epsg:2154"]);

        const Intersections: dbIntersections[] = rawIntersections.map((intersection) => {
          return {
            coords: intersection.geometry.coordinates,
            _id: parseInt(intersection.properties.gid),
            nature: intersection.properties.nature,
          };
        });

        await Intersection.deleteMany({
          _id: { $nin: Intersections.map((i) => i._id) },
        });
        await Intersection.bulkWrite(
          bulkOps("updateOne", Intersections as unknown as Record<keyof dbIntersections, unknown>[]),
        );

        return true;
      },
      Intersection,
    ),
  ] as const;
};
