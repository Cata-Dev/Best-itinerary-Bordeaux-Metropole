import { BaseTBM, TBMEndpoints } from "..";
import { Application } from "../../../declarations";
import { bulkOps, cartographicDistance } from "../../../utils";
import { Endpoint } from "../../endpoint";
import TBM_Sections, { dbSections } from "data/lib/models/TBM/sections.model";

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
  geometry: { coordinates: [number, number][] };
};

export default (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Section = TBM_Sections(app.get("mongooseClient"));

  return [
    new Endpoint(
      TBMEndpoints.Sections,
      24 * 3600,
      async () => {
        const rawSections: Section[] = await getData("fv_tronc_l", ["crs=epsg:2154"]);

        const Sections: dbSections[] = rawSections.map((section) => {
          return {
            coords: section.geometry.coordinates,
            distance: section.geometry.coordinates.reduce((acc: number, v, i, arr) => {
              if (i < arr.length - 1) return acc + cartographicDistance(...v, ...arr[i + 1]);
              return acc;
            }, 0),
            _id: parseInt(section.properties.gid),
            domanial: parseInt(section.properties.domanial) || 0,
            cat_dig: parseInt(section.properties.cat_dig),
            groupe: section.properties.groupe || 0,
            nom_voie: section.properties.nom_voie,
            rg_fv_graph_dbl: !!section.properties.rg_fv_graph_dbl,
            rg_fv_graph_nd: section.properties.rg_fv_graph_nd,
            rg_fv_graph_na: section.properties.rg_fv_graph_na,
          };
        });

        await Section.deleteMany({
          _id: { $nin: Sections.map((s) => s._id) },
        });
        await Section.bulkWrite(
          bulkOps("updateOne", Sections as unknown as Record<keyof dbSections, unknown>[]),
        );

        return true;
      },
      Section,
    ),
  ] as const;
};
