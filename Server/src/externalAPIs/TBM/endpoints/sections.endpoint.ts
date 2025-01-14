import { Coords, euclideanDistance } from "common/geographics";
import { TBMEndpoints } from "data/models/TBM/index";
import TBM_Sections, { dbSections } from "data/models/TBM/sections.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkOps } from "../../../utils";
import { makeConcurrentHook } from "../../concurrentHook";
import { Endpoint } from "../../endpoint";

export type Section = BaseTBM<{
  gid: string;
  domanial: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
  groupe: number;
  cat_dig: string;
  cat_rhv: string;
  passage: "INFERIEUR" | "SUPERIEUR";
  nom_voie: string;
  voiegrandtrafic: boolean;
  rg_fv_graph_dbl: number;
  rg_fv_graph_nd: number;
  rg_fv_graph_na: number;
}> & {
  geometry:
    | { coordinates: Coords[] }
    // Wtf ? Happened on 05-12-2024
    | null;
};

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Section = TBM_Sections(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Sections,
      24 * 3600,
      async () => {
        const rawSections: Section[] = await getData("fv_tronc_l", ["crs=epsg:2154"]);

        const Sections: dbSections[] = rawSections
          .filter(
            (section): section is Omit<Section, "geometry"> & { geometry: { coordinates: Coords[] } } =>
              !!section.geometry,
          )
          .map((section) => {
            if ((section.geometry.coordinates?.[0]?.[0] as never)?.[0])
              // Depth 3 => MultiLineString
              section.geometry.coordinates = section.geometry.coordinates.flat() as Extract<
                Section,
                { geometry: { coordinates: unknown } }
              >["geometry"]["coordinates"];

            return {
              coords: section.geometry.coordinates,
              distance: section.geometry.coordinates.reduce((acc: number, v, i, arr) => {
                if (i < arr.length - 1) return acc + euclideanDistance(...v, ...arr[i + 1]);

                return acc;
              }, 0),
              _id: parseInt(section.properties.gid),
              domanial: parseInt(section.properties.domanial ?? 7),
              cat_dig: parseInt(section.properties.cat_dig ?? 10),
              groupe: section.properties.groupe ?? 0,
              nom_voie: section.properties.nom_voie,
              rg_fv_graph_dbl: !!section.properties.rg_fv_graph_dbl,
              rg_fv_graph_nd: section.properties.rg_fv_graph_nd,
              rg_fv_graph_na: section.properties.rg_fv_graph_na,
            };
          })
          // Got null ends once...
          .filter((s) => s.rg_fv_graph_nd !== null && s.rg_fv_graph_na !== null);

        await Section.deleteMany({
          _id: { $nin: Sections.map((s) => s._id) },
        });
        await Section.bulkWrite(
          bulkOps("updateOne", Sections as unknown as Record<keyof dbSections, unknown>[]),
        );

        return true;
      },
      Section,
    )
      .registerHook(makeNSRHook(app, TBMEndpoints.Sections))
      .init(),
  ] as const;
};

export const makeNSRHook = makeConcurrentHook((app) =>
  // Could be effectively awaited (through job.waitUntilFinished(queue))
  app
    .get("computeInstance")
    .app.queues[3].add("computeNSR", [5e3])
    .catch((err) => logger.error("Failed to start computing Non Schedules Routes", err)),
);
