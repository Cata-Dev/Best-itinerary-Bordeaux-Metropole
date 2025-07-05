// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, Params, ServiceInterface } from "@feathersjs/feathers";

import type { Application } from "../../declarations";
import {
  Transport,
  type Journey,
  type JourneyData,
  type JourneyPatch,
  type JourneyQuery,
} from "./journey.schema";

export type { Journey, JourneyData, JourneyPatch, JourneyQuery };

export interface JourneyServiceOptions {
  app: Application;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JourneyParams extends Params<JourneyQuery> {}

import { BadRequest, GeneralError, NotFound } from "@feathersjs/errors";
import { hasLastActualization } from "../refresh-data/refresh-data.class";

function hasData(obj: unknown): obj is { data: unknown } {
  return typeof obj === "object" && obj !== null && "data" in obj;
}

import { mapAsync } from "@bibm/common/async";
import { JobData } from "@bibm/compute/lib/jobs";
import resultModelInit, {
  dbComputeResult,
  isJourneyStepFoot,
  isJourneyStepVehicle,
  isLocationAddress,
  isLocationSNCF,
  isLocationTBM,
  JourneyStepFoot,
  JourneyStepVehicle,
} from "@bibm/data/models/Compute/result.model";
import SNCFStopsModelInit from "@bibm/data/models/SNCF/SNCF_stops.model";
import AddressesModelInit, { dbAddresses } from "@bibm/data/models/TBM/addresses.model";
import NonScheduledRoutesModelInit from "@bibm/data/models/TBM/NonScheduledRoutes.model";
import TBMLinesModelInit from "@bibm/data/models/TBM/TBM_lines.model";
import TBMLinesRoutesModelInit from "@bibm/data/models/TBM/TBM_lines_routes.model";
import TBMSchedulesModelInit from "@bibm/data/models/TBM/TBM_schedules.model";
import TBMStopsModelInit from "@bibm/data/models/TBM/TBM_stops.model";
import TBMScheduledRoutesModelInit from "@bibm/data/models/TBM/TBMScheduledRoutes.model";
import { isDocument } from "@typegoose/typegoose";
// To force TypeScript detect "compute" as a JobName
import "@bibm/compute/lib/jobs/compute";

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

  private async populateLocation(loc: dbComputeResult["from"]) {
    const populatedLoc = isLocationAddress(loc)
      ? formatAddress((await this.AddressesModel.findById(loc.id).lean())!)
      : isLocationTBM(loc)
        ? (await this.TBMStopsModel.findById(loc.id).lean())?.libelle
        : isLocationSNCF(loc)
          ? (await this.SNCFStopsModel.findById(loc.id).lean())?.name
          : undefined;

    if (populatedLoc === undefined) throw new GeneralError("Could not populate journey.");

    return populatedLoc;
  }

  private populateResult(result: dbComputeResult): Promise<Journey["paths"]> {
    return mapAsync(result.journeys, async (journey) => {
      return {
        stages: await mapAsync<
          JourneyStepFoot | JourneyStepVehicle,
          Journey["paths"][number]["stages"][number]
        >(
          journey.steps.slice(1).filter((js): js is JourneyStepFoot | JourneyStepVehicle => {
            if (!isJourneyStepFoot(js) && !isJourneyStepVehicle(js)) throw new Error("Unexpected journey.");
            return true;
          }),
          async (js, i, arr) => {
            const to =
              i === arr.length - 1
                ? await this.populateLocation(result.to)
                : isJourneyStepFoot(js)
                  ? typeof js.transfer.to === "number"
                    ? (await this.TBMStopsModel.findById(js.transfer.to).lean())?.libelle
                    : js.transfer.to
                  : typeof arr[i + 1].boardedAt === "number"
                    ? (await this.TBMStopsModel.findById(arr[i + 1].boardedAt).lean())?.libelle
                    : arr[i + 1].boardedAt.toString();

            if (!to) throw new GeneralError("Could not populate journey.");

            if (isJourneyStepFoot(js)) {
              return {
                to,
                type: Transport.FOOT,
                departure:
                  // Arrival of previous step
                  journey.steps[i].time,
                // m / m*s-1 = s
                duration: js.transfer.length / result.settings.walkSpeed,
                details: {
                  distance: js.transfer.length,
                },
              } satisfies Journey["paths"][number]["stages"][number];
            }

            // Only remaining possibility
            if (!isJourneyStepVehicle(js))
              throw new GeneralError("Unexpected error while populating journey");

            const scheduledRoute = await this.TBMScheduledRoutesModel.findById(js.route).lean();
            if (!scheduledRoute)
              throw new GeneralError("Unable to retrieve scheduled route while populating journey");

            // Can only be first journey step of journey, ignored in `arr` by `slice(1)`
            if (typeof js.boardedAt === "string")
              throw new GeneralError("Unexpected error while populating journey");

            const departureTime = (
              await this.TBMSchedulesModel.findById(
                scheduledRoute.trips[js.tripIndex].schedules[scheduledRoute.stops.indexOf(js.boardedAt)],
              ).lean()
            )?.hor_estime.getTime();
            if (departureTime === undefined)
              throw new GeneralError("Unable to retrieve realtime schedule while populating journey");

            const lineRoute = await this.TBMLinesRoutesModel.findById(js.route, undefined, {
              populate: ["rs_sv_ligne_a"],
            });
            if (!lineRoute) throw new GeneralError("Unable to retrieve line route while populating journey");
            if (!isDocument(lineRoute.rs_sv_ligne_a))
              throw new GeneralError("Unable to retrieve line while populating journey");

            return {
              to,
              type: Transport.TBM,
              departure: departureTime,
              // Arrival - departure, in sec
              duration: (js.time - departureTime) / 1e3,
              details: {
                direction: `${lineRoute.libelle} - ${lineRoute.sens}`,
                line: lineRoute.rs_sv_ligne_a.libelle,
                type: lineRoute.vehicule,
              },
            } satisfies Journey["paths"][number]["stages"][number];
          },
        ),
        criteria: journey.criteria.reduce<Record<string, number>>(
          (acc, v) => ({ ...acc, [v.name]: v.value }),
          {},
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

    const endpoints = Object.values(this.app.externalAPIs.endpoints).filter(
      (endpoint) => endpoint.rate < 24 * 3600,
    );
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
      from: await this.populateLocation(result.from),
      departure: result.departureTime.getTime(),
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
      from: await this.populateLocation(result.from),
      departure: result.departureTime.getTime(),
      paths: await this.populateResult(result),
    };
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
