import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_LinkLineRoutesSections, {
  dbTBM_LinkLineRoutesSections,
} from "@bibm/data/models/TBM/TBM_link_line_routes_sections.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { Endpoint, makeConcurrentHook } from "../../endpoint";

export type TBM_LinkLineRoutesSections = BaseTBM<{
  rs_sv_chem_l: number;
  rs_sv_tronc_l: number;
}>;

export default async (
  app: Application,
  getRelationData: <T>(relation: string, queries?: string[]) => Promise<T>,
) => {
  const LinkLineRoutesSections = TBM_LinkLineRoutesSections(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.LinkLineRoutesSections,
      24 * 3600,
      async () => {
        const rawLinkLineRoutesSections: TBM_LinkLineRoutesSections[] =
          await getRelationData("SV_TRONC_L/SV_CHEM_L");

        const linkLineRoutesSections: dbTBM_LinkLineRoutesSections[] = rawLinkLineRoutesSections.map(
          (linkLineRoutesSection) => {
            return {
              rs_sv_chem_l: linkLineRoutesSection.properties.rs_sv_chem_l,
              rs_sv_tronc_l: linkLineRoutesSection.properties.rs_sv_tronc_l,
            };
          },
        );

        const bulked = await LinkLineRoutesSections.bulkWrite(
          bulkOps(
            "updateOne",
            linkLineRoutesSections as unknown as Record<keyof dbTBM_LinkLineRoutesSections, unknown>[],
            ["rs_sv_chem_l", "rs_sv_tronc_l"],
          ),
        );
        await LinkLineRoutesSections.deleteMany({
          _id: { $nin: Object.values(bulked.upsertedIds).concat(Object.values(bulked.insertedIds)) },
        });

        return true;
      },
      LinkLineRoutesSections,
    ).init(),
  ] as const;
};

export const makeLinkLineRoutesHook = makeConcurrentHook(
  (app) =>
    void app.externalAPIs.TBM.endpoints[TBMEndpoints.LinkLineRoutesSections]
      .fetch(true, app.get("debug"))
      .catch((err) => logger.warn(err)),
);
