// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import type { Path, PathData, PathPatch, PathQuery } from "./path.schema";
import { BadRequest, GeneralError, NotFound } from "@feathersjs/errors";
import { JobResult } from "compute/lib/jobs";
import { mapAsync } from "common/async";
import TBMIntersectionsModelInit from "data/models/TBM/intersections.model";

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

  constructor(public options: PathServiceOptions) {
    this.app = options.app;
    this.TBMIntersectionsModel = TBMIntersectionsModelInit(this.app.get("sourceDBConn"));
  }

  async get(id: Id, params?: ServiceParams): Promise<Path> {
    if (!params || !params.query) throw new BadRequest(`Missing required parameter(s).`);

    const { from, to } = params.query;

    switch (id) {
      case "foot": {
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

      default:
        throw new NotFound("Unknown command.");
    }
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
