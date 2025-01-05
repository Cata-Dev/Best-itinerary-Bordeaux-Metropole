// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import type { Path, PathData, PathPatch, PathQuery } from "./path.schema";
import { BadRequest, GeneralError } from "@feathersjs/errors";
import { JobResult } from "compute/lib/jobs";
import { mapAsync } from "common/async";
import TBMIntersectionsModelInit from "data/models/TBM/intersections.model";
import resultModelInit, {
  dbComputeResult,
  isLabelFoot,
  isLocationAddress,
  isLocationSNCF,
  isLocationTBM,
} from "data/models/Compute/result.model";
import AddressesModelInit from "data/models/TBM/addresses.model";
import TBMStopsModelInit from "data/models/TBM/TBM_stops.model";
import SNCFStopsModelInit from "data/models/SNCF/SNCF_stops.model";

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
  private readonly resultModel: ReturnType<typeof resultModelInit>;
  private readonly AddressesModel: ReturnType<typeof AddressesModelInit>;
  private readonly TBMStopsModel: ReturnType<typeof TBMStopsModelInit>;
  private readonly SNCFStopsModel: ReturnType<typeof SNCFStopsModelInit>;

  constructor(public options: PathServiceOptions) {
    this.app = options.app;
    this.TBMIntersectionsModel = TBMIntersectionsModelInit(this.app.get("sourceDBConn"));
    this.resultModel = resultModelInit(this.app.get("computeDBConn"));
    this.AddressesModel = AddressesModelInit(this.app.get("sourceDBConn"));
    this.TBMStopsModel = TBMStopsModelInit(this.app.get("sourceDBConn"));
    this.SNCFStopsModel = SNCFStopsModelInit(this.app.get("sourceDBConn"));
  }

  private async getCoords(loc: dbComputeResult["from"]): Promise<[number, number]> {
    const coords = (
      isLocationAddress(loc)
        ? await this.AddressesModel.findById(loc.id).lean()
        : isLocationTBM(loc)
          ? await this.TBMStopsModel.findById(loc.id).lean()
          : isLocationSNCF(loc)
            ? await this.SNCFStopsModel.findById(loc.id).lean()
            : { coords: undefined }
    )?.coords;

    if (!coords) throw new Error("Unexpected or not found location.");

    return coords;
  }

  /**
   * Helper to compute & format a path
   */
  private async makePath(from: [number, number], to: [number, number]) {
    let result: JobResult<"computeFp">;

    try {
      result = await (
        await this.app.get("computeInstance").app.queues[1].add("computeFp", [from, to])
      ).waitUntilFinished(this.app.get("computeInstance").app.queuesEvents[1]);
    } catch (e) {
      throw new GeneralError("Error while computing path", e);
    }

    return {
      length: result.distance,
      steps: await mapAsync(result.path, async (node) => {
        if (node === "aps") return from;
        else if (node === "apt") return to;
        const intersection = await this.TBMIntersectionsModel.findById(node);
        if (!intersection) throw new GeneralError("Unexpected path while populating");
        return intersection.coords;
      }),
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

        return Promise.all(
          journey.journeys[params.query.index].reduce<Promise<Path>[]>(
            (acc, label, i, arr) =>
              isLabelFoot(label)
                ? [
                    ...acc,
                    (async () => {
                      const from =
                        i === 0
                          ? // First label, source comes from "from"
                            await this.getCoords(journey.from)
                          : // Source comes from "boardedAt", must be a stop id by construction
                            // because it's a string <=> it's source or target
                            (await this.TBMStopsModel.findById(label.boardedAt as number).lean())?.coords;

                      if (!from) throw new Error("Unable to retrieve journey path source.");

                      const to =
                        i === arr.length - 1
                          ? // Last label, target comes from "to"
                            await this.getCoords(journey.to)
                          : // Target comes from "to", must be a stop id by construction
                            // because it's a string <=> it's source or target
                            (await this.TBMStopsModel.findById(label.transfer.to as number).lean())?.coords;

                      if (!to) throw new Error("Unable to retrieve journey path destination.");

                      return await this.makePath(from, to);
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
        if (!("from" in params.query)) throw new BadRequest(`Missing required parameter(s).`);
        const { from, to } = params.query;

        return this.makePath(from, to);
      }

      default:
        throw new BadRequest("Unknown command.");
    }
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
