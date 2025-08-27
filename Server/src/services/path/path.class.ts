// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import { mapAsync } from "@bibm/common/async";
import { Coords } from "@bibm/common/geographics";
import { JobResult } from "@bibm/compute/lib/jobs";
import resultModelInit, {
  dbComputeResult,
  isJourneyStepFoot,
  isJourneyStepVehicle,
  isLocationAddress,
  isLocationSNCF,
  isLocationTBM,
} from "@bibm/data/models/Compute/result.model";
import SNCFStopsModelInit from "@bibm/data/models/SNCF/SNCF_stops.model";
import AddressesModelInit from "@bibm/data/models/TBM/addresses.model";
import TBMIntersectionsModelInit from "@bibm/data/models/TBM/intersections.model";
import TBMSectionsModelInit, { dbSections } from "@bibm/data/models/TBM/sections.model";
import TBMLinkLineRoutesSectionsInit from "@bibm/data/models/TBM/TBM_link_line_routes_sections.model";
import TBMRouteSectionsModelInit, {
  dbTBM_RouteSections,
} from "@bibm/data/models/TBM/TBM_route_sections.model";
import TBMStopsModelInit from "@bibm/data/models/TBM/TBM_stops.model";
import { Dijkstra } from "@catatomik/dijkstra";
import { WeightedGraph } from "@catatomik/dijkstra/lib/utils/Graph";
import { BadRequest, GeneralError } from "@feathersjs/errors";
import { isDocument } from "@typegoose/typegoose";
import type { Application } from "../../declarations";
import { Transport } from "../journey/journey.schema";
import type { Path, PathData, PathPatch, PathQuery } from "./path.schema";

export type { Path, PathData, PathPatch, PathQuery };

export interface PathServiceOptions {
  app: Application;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PathParams extends Params<PathQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class PathService<ServiceParams extends PathParams = PathParams>
  implements ServiceInterface<Path, PathData, ServiceParams, PathPatch>
{
  private readonly app: Application;
  private readonly TBMIntersectionsModel: ReturnType<typeof TBMIntersectionsModelInit>;
  private readonly TBMSectionsModel: ReturnType<typeof TBMSectionsModelInit>;
  private readonly resultModel: ReturnType<typeof resultModelInit>;
  private readonly AddressesModel: ReturnType<typeof AddressesModelInit>;
  private readonly TBMStopsModel: ReturnType<typeof TBMStopsModelInit>;
  private readonly SNCFStopsModel: ReturnType<typeof SNCFStopsModelInit>;
  private readonly TBMRouteSectionsModel: ReturnType<typeof TBMRouteSectionsModelInit>;
  private readonly TBMLinkLineRoutesSectionsModel: ReturnType<typeof TBMLinkLineRoutesSectionsInit>;

  constructor(public options: PathServiceOptions) {
    this.app = options.app;
    this.TBMIntersectionsModel = TBMIntersectionsModelInit(this.app.get("sourceDBConn"));
    this.TBMSectionsModel = TBMSectionsModelInit(this.app.get("sourceDBConn"));
    this.resultModel = resultModelInit(this.app.get("computeDBConn"));
    this.AddressesModel = AddressesModelInit(this.app.get("sourceDBConn"));
    this.TBMStopsModel = TBMStopsModelInit(this.app.get("sourceDBConn"));
    this.SNCFStopsModel = SNCFStopsModelInit(this.app.get("sourceDBConn"));
    this.TBMRouteSectionsModel = TBMRouteSectionsModelInit(this.app.get("sourceDBConn"));
    this.TBMLinkLineRoutesSectionsModel = TBMLinkLineRoutesSectionsInit(this.app.get("sourceDBConn"));
  }

  private async getCoords(loc: dbComputeResult["from"]): Promise<Coords> {
    const coords = (
      isLocationAddress(loc)
        ? await this.AddressesModel.findById(loc.id).lean()
        : isLocationTBM(loc)
          ? await this.TBMStopsModel.findById(loc.id).lean()
          : isLocationSNCF(loc)
            ? await this.SNCFStopsModel.findById(loc.id).lean()
            : { coords: undefined }
    )?.coords;

    if (!coords) throw new GeneralError("Unexpected or not found location.");

    return coords;
  }

  /**
   * Helper to compute & format a foot path
   */
  private async makeFootPath(
    from: Coords,
    to: Coords,
    realShape: boolean,
  ): Promise<Extract<Path, { type: Transport.FOOT }>> {
    let result: JobResult<"computeFp">;

    try {
      result = await (
        await this.app.get("computeInstance").app.queues[1].add("computeFp", [from, to])
      ).waitUntilFinished(this.app.get("computeInstance").app.queuesEvents[1]);
    } catch (e) {
      throw new GeneralError("Error while computing path", e);
    }

    const steps = await mapAsync<(typeof result)["path"][number], Coords | Coords[]>(
      result.path,
      realShape
        ? async (node, i, arr): Promise<Coords[]> => {
            if (i === arr.length - 1) return [] as Coords[];

            if (node === "apt")
              // Should only be at index i = len - 1
              throw new GeneralError("Unexpected path while populating");

            const nextNode = arr[i + 1];
            if (nextNode === "aps")
              // Should only be at index 0
              throw new GeneralError("Unexpected path while populating");

            let fromAps: dbSections | null = null;
            if (node === "aps") {
              fromAps = await this.TBMSectionsModel.findById(result.apDetails[0].sectionId);
              if (!fromAps) throw new GeneralError("Unexpected path while populating shape");

              if (nextNode !== "apt") {
                // <=> nextNode is number
                // Find in which direction to take fromAps
                if (fromAps.rg_fv_graph_nd === nextNode) {
                  return [
                    from,
                    result.apDetails[0].approachedPoint,
                    ...fromAps.coords.slice(0, result.apDetails[0].idx + 1).toReversed(),
                  ];
                } else if (fromAps.rg_fv_graph_na === nextNode) {
                  return [
                    from,
                    result.apDetails[0].approachedPoint,
                    ...fromAps.coords.slice(result.apDetails[0].idx + 1),
                  ];
                } else throw new GeneralError("Unexpected path while populating shape");
              }
            }

            let toApt: dbSections | null = null;
            if (nextNode === "apt") {
              toApt = await this.TBMSectionsModel.findById(result.apDetails[1].sectionId);
              if (!toApt) throw new GeneralError("Unexpected path while populating shape");

              if (toApt && node !== "aps") {
                // fromAps must be null <=> node is number
                // Find in which direction to take toApt
                if (toApt.rg_fv_graph_nd === node) {
                  return [
                    ...toApt.coords.slice(0, result.apDetails[1].idx + 1),
                    result.apDetails[1].approachedPoint,
                    to,
                  ];
                } else if (toApt.rg_fv_graph_na === node) {
                  return [
                    ...toApt.coords.slice(result.apDetails[1].idx + 1).toReversed(),
                    result.apDetails[1].approachedPoint,
                    to,
                  ];
                } else throw new GeneralError("Unexpected path while populating shape");
              }
            }

            if (fromAps && toApt) {
              // Path is [aps, apt]
              // They must have an end in common, find it
              if (fromAps.rg_fv_graph_na === toApt.rg_fv_graph_nd)
                return [
                  from,
                  result.apDetails[0].approachedPoint,
                  ...fromAps.coords.slice(result.apDetails[0].idx + 1).toReversed(),
                  ...toApt.coords.slice(0, result.apDetails[1].idx + 1),
                  result.apDetails[1].approachedPoint,
                  to,
                ];
              else if (fromAps.rg_fv_graph_nd === toApt.rg_fv_graph_na)
                return [
                  from,
                  result.apDetails[0].approachedPoint,
                  ...fromAps.coords.slice(0, result.apDetails[0].idx + 1).toReversed(),
                  ...toApt.coords.slice(result.apDetails[1].idx + 1).toReversed(),
                  result.apDetails[1].approachedPoint,
                  to,
                ];
              else throw new GeneralError("Unexpected path while populating ");
            }

            // General case (no node is aps/apt)
            const section = await this.TBMSectionsModel.findOne({
              $or: [
                {
                  rg_fv_graph_nd: node,
                  rg_fv_graph_na: nextNode,
                },
                {
                  rg_fv_graph_nd: nextNode,
                  rg_fv_graph_na: node,
                },
              ],
            });
            if (!section) throw new GeneralError("Unexpected path while populating shape");

            if (section.rg_fv_graph_nd !== node)
              // Reversed direction
              section.coords.reverse();

            return section.coords;
          }
        : async (node): Promise<Coords> => {
            if (node === "aps") return from;
            else if (node === "apt") return to;
            const intersection = await this.TBMIntersectionsModel.findById(node);
            if (!intersection) throw new GeneralError("Unexpected path while populating");
            return intersection.coords;
          },
    );

    return {
      length: result.distance,
      steps: (realShape ? steps.filter((s) => s.length) : steps) as Coords[] | Coords[][],
      type: Transport.FOOT,
    };
  }

  async find(params?: ServiceParams): Promise<Path[]> {
    if (!params || !params.query) throw new BadRequest(`Missing required query.`);

    if (!("for" in params.query)) throw new BadRequest(`Invalid query.`);

    switch (params.query.for) {
      case "journey": {
        if (!("id" in params.query)) throw new BadRequest(`Missing required parameter(s).`);

        const journey = await this.resultModel.findById(params.query.id);
        if (!journey) throw new BadRequest(`Invalid journey id (missing).`);

        const { realShape } = params.query;

        return Promise.all(
          journey.journeys[params.query.index].steps.reduce<Promise<Path>[]>(
            (acc, journeyStep, i, arr) =>
              isJourneyStepFoot(journeyStep)
                ? [
                    ...acc,
                    (async () => {
                      const from =
                        i === 1
                          ? // First effective journey step (very first is a base journey step), source comes from "from"
                            await this.getCoords(journey.from)
                          : // Source comes from "boardedAt", must be a stop id by construction
                            // because it's a string <=> it's source or target
                            (await this.TBMStopsModel.findById(journeyStep.boardedAt as number).lean())
                              ?.coords;

                      if (!from) throw new GeneralError("Unable to retrieve journey foot path source.");

                      const to =
                        i === arr.length - 1
                          ? // Last journey step, target comes from "to"
                            await this.getCoords(journey.to)
                          : // Target comes from "to", must be a stop id by construction
                            // because it's a string <=> it's source or target
                            (await this.TBMStopsModel.findById(journeyStep.transfer.to as number).lean())
                              ?.coords;

                      if (!to) throw new GeneralError("Unable to retrieve journey foot path destination.");

                      return await this.makeFootPath(from, to, realShape);
                    })(),
                  ]
                : isJourneyStepVehicle(journeyStep)
                  ? [
                      ...acc,
                      (async () => {
                        const from =
                          // Must come from stop <=> stop id <=> number
                          journeyStep.boardedAt as number;

                        let to: number;
                        if (i < arr.length - 1) {
                          const nextJourneyStep = arr[i + 1];
                          if (!("boardedAt" in nextJourneyStep))
                            throw new GeneralError("Unexpected journey construction.");

                          to =
                            // Must go to stop <=> stop id <=> number
                            nextJourneyStep?.boardedAt as number;
                        } else {
                          if (!isLocationTBM(journey.to))
                            throw new GeneralError("Unexpected journey construction.");

                          to = journey.to.id as number;
                        }

                        if (isDocument(journeyStep.route))
                          throw new GeneralError("Unexpected populated journey step.");

                        return await this.get("tbm", {
                          query: { from, to, line: journeyStep.route } satisfies PathParams["query"],
                        } as ServiceParams);
                      })(),
                    ]
                  : acc,
            [],
          ),
        );
      }

      default:
        throw new BadRequest("Unknown target.");
    }
  }

  async get(id: Id, params?: ServiceParams): Promise<Path> {
    if (!params || !params.query) throw new BadRequest(`Missing required query.`);

    switch (id) {
      case "foot": {
        if (!("from" in params.query) || !("realShape" in params.query))
          throw new BadRequest(`Missing required parameter(s).`);
        const { from, to, realShape } = params.query;

        return this.makeFootPath(from, to, realShape);
      }

      case "tbm": {
        if (!("line" in params.query)) throw new BadRequest(`Missing required parameter(s).`);
        const { line, from, to } = params.query;

        const links = await this.TBMLinkLineRoutesSectionsModel.find({ rs_sv_chem_l: line }, undefined, {
          populate: { path: "rs_sv_tronc_l", model: this.TBMRouteSectionsModel },
        });
        if (!links.length) throw new GeneralError(`Unable to find paths for line ${line}.`);
        if (
          !links.every((link): link is typeof link & { rs_sv_tronc_l: dbTBM_RouteSections } =>
            isDocument(link.rs_sv_tronc_l),
          )
        )
          throw new GeneralError(`Unexpected unpopulated link.`);

        const linksGraph = new WeightedGraph<number>();
        for (const link of links)
          linksGraph.addArc(
            link.rs_sv_tronc_l.rg_sv_arret_p_nd as number,
            link.rs_sv_tronc_l.rg_sv_arret_p_na as number,
          );

        const sectionsPath = Dijkstra(linksGraph, [from, to] satisfies [unknown, unknown]);
        if (sectionsPath.length < 2) throw new GeneralError("Unable to determine path.");

        return {
          type: Transport.TBM,
          line,
          steps: sectionsPath.reduce<[number, number][][]>((acc, v, i, arr) => {
            if (i === arr.length - 1) return acc;

            const section = links.find(
              (link) =>
                link.rs_sv_tronc_l.rg_sv_arret_p_nd === v &&
                link.rs_sv_tronc_l.rg_sv_arret_p_na === arr[i + 1],
            );
            if (!section) throw new GeneralError("Unexpected unobtainable section. ");

            return acc.concat([section.rs_sv_tronc_l.coords]);
          }, []),
        };
      }

      default:
        throw new BadRequest("Unknown command.");
    }
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
