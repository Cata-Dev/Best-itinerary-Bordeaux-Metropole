// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import type { Journey, JourneyData, JourneyPatch, JourneyQuery } from "./journey.schema";

export type { Journey, JourneyData, JourneyPatch, JourneyQuery };

export interface JourneyServiceOptions {
  app: Application;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JourneyParams extends Params<JourneyQuery> {}

import { BadRequest, NotFound, GeneralError } from "@feathersjs/errors";
import { hasLastActualization } from "../refresh-data/refresh-data.class";

function hasData(obj: unknown): obj is { data: unknown } {
  return typeof obj === "object" && obj !== null && "data" in obj;
}

import resultModelInit, {
  dbComputeResult,
  isLabelFoot,
  isLabelVehicle,
  isLocationAddress,
  isLocationSNCF,
  isLocationTBM,
  LabelFoot,
  LabelVehicle,
} from "data/lib/models/Compute/result.model";
import NonScheduledRoutesModelInit from "data/lib/models/TBM/NonScheduledRoutes.model";
import TBMScheduledRoutesModelInit from "data/lib/models/TBM/TBMScheduledRoutes.model";
import AddressesModelInit, { dbAddresses } from "data/lib/models/TBM/addresses.model";
import TBMStopsModelInit from "data/lib/models/TBM/TBM_stops.model";
import TBMSchedulesModelInit from "data/lib/models/TBM/TBM_schedules.model";
import TBMLinesRoutesModelInit from "data/lib/models/TBM/TBM_lines_routes.model";
import TBMLinesModelInit from "data/lib/models/TBM/TBM_lines.model";
import SNCFStopsModelInit from "data/lib/models/SNCF/SNCF_stops.model";
// To force TypeScript detect "compute" as a JobName
import "compute/lib/jobs/compute";
import { JobData } from "compute/lib/jobs";
import { mapAsync } from "common/async";
import { isDocument } from "@typegoose/typegoose";

function formatAddress(addressDoc: dbAddresses) {
  return `${addressDoc.numero} ${"rep" in addressDoc ? addressDoc.rep + " " : ""}${addressDoc.nom_voie} ${addressDoc.commune}`;
}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class JourneyService<ServiceParams extends JourneyParams = JourneyParams>
  implements ServiceInterface<Journey, JourneyData, ServiceParams, JourneyPatch>
{
  private readonly app: Application;
  private readonly resultModel: ReturnType<typeof resultModelInit>;
  private readonly TBMStopsModel: ReturnType<typeof TBMStopsModelInit>;
  private readonly TBMSchedulesModel: ReturnType<typeof TBMSchedulesModelInit>[1];
  private readonly TBMLinesRoutesModel: ReturnType<typeof TBMLinesRoutesModelInit>;
  private readonly TBMLinesModel: ReturnType<typeof TBMLinesModelInit>;
  private readonly AddressesModel: ReturnType<typeof AddressesModelInit>;
  private readonly SNCFStopsModel: ReturnType<typeof SNCFStopsModelInit>;
  private readonly NonScheduledRoutesModel: ReturnType<typeof NonScheduledRoutesModelInit>;
  private readonly TBMScheduledRoutesModel: ReturnType<typeof TBMScheduledRoutesModelInit>;

  constructor(public options: JourneyServiceOptions) {
    this.app = options.app;
    this.resultModel = resultModelInit(this.app.get("computeDBConn"));
    this.AddressesModel = AddressesModelInit(this.app.get("sourceDBConn"));
    this.TBMStopsModel = TBMStopsModelInit(this.app.get("sourceDBConn"));
    this.TBMSchedulesModel = TBMSchedulesModelInit(this.app.get("sourceDBConn"))[1];
    this.TBMLinesRoutesModel = TBMLinesRoutesModelInit(this.app.get("sourceDBConn"));
    this.TBMLinesModel = TBMLinesModelInit(this.app.get("sourceDBConn"));
    this.SNCFStopsModel = SNCFStopsModelInit(this.app.get("sourceDBConn"));
    this.NonScheduledRoutesModel = NonScheduledRoutesModelInit(this.app.get("sourceDBConn"));
    this.TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(this.app.get("sourceDBConn"));
  }

  private populateResult(result: dbComputeResult): Promise<Journey["paths"]> {
    return mapAsync(result.journeys, async (j) => {
      const from = isLocationAddress(result.from)
        ? formatAddress((await this.AddressesModel.findById(result.from.id).lean())!)
        : isLocationTBM(result.from)
          ? (await this.TBMStopsModel.findById(result.from.id).lean())?.libelle
          : isLocationSNCF(result.from)
            ? (await this.SNCFStopsModel.findById(result.from.id).lean())?.name
            : null;

      if (!from) throw new GeneralError("Could not populate journey.");

      return {
        departure: j[0].time,
        from,
        stages: await mapAsync<LabelFoot | LabelVehicle, Journey["paths"][number]["stages"][number]>(
          j.slice(1).filter((l): l is LabelFoot | LabelVehicle => {
            if (!isLabelFoot(l) && !isLabelVehicle(l)) throw new Error("Unexpected journey.");
            return true;
          }),
          async (l, i, arr) => {
            const to =
              i === arr.length - 1
                ? isLocationAddress(result.to)
                  ? formatAddress((await this.AddressesModel.findById(result.to.id).lean())!)
                  : isLocationTBM(result.to)
                    ? (await this.TBMStopsModel.findById(result.to.id).lean())?.libelle
                    : isLocationSNCF(result.to)
                      ? (await this.SNCFStopsModel.findById(result.to.id).lean())?.name
                      : null
                : isLabelFoot(l)
                  ? typeof l.transfer.to === "number"
                    ? (await this.TBMStopsModel.findById(l.transfer.to).lean())?.libelle
                    : l.transfer.to
                  : typeof arr[i + 1].boardedAt === "number"
                    ? (await this.TBMStopsModel.findById(arr[i + 1].boardedAt).lean())?.libelle
                    : (arr[i + 1].boardedAt as string);

            if (!to) throw new GeneralError("Could not populate journey.");

            if (isLabelFoot(l)) {
              return {
                to,
                type: "FOOT",
                // m / m*s-1 = s
                duration: l.transfer.length / result.settings.walkSpeed,
                details: {
                  distance: l.transfer.length,
                },
              } satisfies Journey["paths"][number]["stages"][number];
            }

            // Only remaining possibility
            if (!isLabelVehicle(l)) throw new GeneralError("Unexpected error while populating journey");
            const scheduledRoute = (await this.TBMScheduledRoutesModel.findById(l.route).lean())!;

            // Can only be first label of journey, ignored in `arr` by `slice(1)`
            if (typeof l.boardedAt === "string")
              throw new GeneralError("Unexpected error while populating journey");

            const departureTime = (await this.TBMSchedulesModel.findById(
              scheduledRoute.trips[l.tripIndex].schedules[scheduledRoute.stops.indexOf(l.boardedAt)],
            ).lean())!.hor_estime.getTime();

            const lineRoute = await this.TBMLinesRoutesModel.findById(l.route, undefined, {
              populate: ["rs_sv_ligne_a"],
            });
            if (!lineRoute || !isDocument(lineRoute.rs_sv_ligne_a))
              throw new GeneralError("Unexpected error while populating journey");

            return {
              to,
              type: "TBM",
              // Arrival - departure, in sec
              duration: (l.time - departureTime) / 1e3,
              details: {
                departure: departureTime,
                direction: `${lineRoute.libelle} - ${lineRoute.sens}`,
                line: lineRoute.rs_sv_ligne_a.libelle,
                type: lineRoute.vehicule,
              },
            } satisfies Journey["paths"][number]["stages"][number];
          },
        ),
      };
    });
  }

  async find(_params?: ServiceParams): Promise<Journey> {
    if (!_params || !_params.query || !("from" in _params.query))
      throw new BadRequest(`Missing required parameter(s).`);

    const waitForUpdate = (_params && _params.query?.waitForUpdate) ?? false;
    const force = (_params && _params.query?.force) ?? false;

    const RAPTORSettings: JobData<"compute">[3] = {};
    if (_params.query.walkSpeed) RAPTORSettings.walkSpeed = _params.query.walkSpeed;

    const params: Parameters<
      ReturnType<typeof this.app.get<"computeInstance">>["app"]["computeFullJourney"]
    > = [
      _params.query.from,
      _params.query.to,
      new Date(_params.query.departureTime ?? Date.now()),
      RAPTORSettings,
    ];

    const endpoints = this.app.externalAPIs.endpoints.filter((endpoint) => endpoint.rate < 24 * 3600);
    let lastActualization = 0;
    const actualization = mapAsync(endpoints, (e) =>
      this.app
        .service("refresh-data")
        .get(e.name, {
          query: {
            waitForUpdate,
            force,
          },
        })
        .catch((r) => {
          if (
            waitForUpdate &&
            hasData(r) &&
            hasLastActualization(r.data) &&
            r.data.lastActualization > lastActualization
          )
            lastActualization = r.data.lastActualization;
        }),
    );

    if (waitForUpdate) {
      // Ask for a possible non-daily data actualization
      await actualization;
      lastActualization = Date.now();
    }

    const job = (await this.app.get("computeInstance").app.computeFullJourney(...params)).job;
    let resultId: (typeof job)["returnvalue"];

    try {
      resultId = await job.waitUntilFinished(this.app.get("computeInstance").app.queuesEvents[0]);
    } catch (e) {
      throw new GeneralError("Error while computing paths", e);
    }

    const result = await this.resultModel.findById(resultId);
    if (!result) throw new GeneralError("Internal error while retrieving results");

    return {
      code: 200,
      message: "OK",
      lastActualization,
      id: resultId,
      paths: await this.populateResult(result),
    };
  }

  async get(id: Id, _?: ServiceParams): Promise<Journey> {
    const result = await this.resultModel.findById(id);
    if (!result) throw new NotFound("Unknown result.");

    return {
      code: 200,
      message: "OK",
      lastActualization: 0,
      id,
      paths: await this.populateResult(result),
    };
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
