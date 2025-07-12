import { Coords, euclideanDistance } from "@bibm/common/geographics";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Sections, { dbSections } from "@bibm/data/models/TBM/sections.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint, makeConcurrentHook, sequenceHooksConstructor } from "../../endpoint";

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
        const rawSections: Section[] = await getData("fv_tronc_l", [
          "filter=" +
            JSON.stringify({
              cat_dig: {
                $in: [2, 3, 4, 5, 7, 9, 10],
              },
            }),
          "crs=epsg:2154",
        ]);

        const sections: dbSections[] = rawSections
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

        await bulkUpsertAndPurge(Section, sections, ["_id"]);

        return true;
      },
      Section,
    )
      .registerHook(
        sequenceHooksConstructor(
          () => () => app.get("computeInstance").refreshData(["computeFp"]),
          makeNSRHook(app, TBMEndpoints.Sections),
        ),
      )
      .init(),
  ] as const;
};

export const makeNSRHook = makeConcurrentHook(
  (app) =>
    // Could be effectively awaited (through job.waitUntilFinished(queue))
    void app
      .get("computeInstance")
      .app.queues[3].add("computeNSR", [5_000])
      .catch((err) => logger.error("Failed to start computing Non Schedules Routes", err)),
);
