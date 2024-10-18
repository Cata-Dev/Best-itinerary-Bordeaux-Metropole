import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import type { RAPTORRunSettings } from "raptor";
import SharedRAPTOR from "raptor/lib/shared";
import { Stop } from "raptor/lib/Structures";
import { SharedRAPTORData } from "raptor/lib/SharedStructures";
import { defaultRAPTORRunSettings } from "data/lib/values/RAPTOR";
import ResultModelInit, {
  JourneyLabelType,
  LabelBase,
  LabelFoot,
  LabelVehicle,
  LocationAddress,
  LocationSNCF,
  LocationTBM,
  LocationType,
  dbComputeResult,
} from "data/lib/models/Compute/result.model";
import stopsModelInit from "data/lib/models/TBM/TBM_stops.model";
import { ItineraryQuery } from "server";
import type { BaseApplication } from "../base";
import { withDefaults } from "../utils";
import type { JobFn, JobResult } from ".";
import { DocumentType } from "@typegoose/typegoose";
import { TBMEndpoints } from "server/externalAPIs/TBM/index";

// type IdType<M> = M extends { _id: infer I } ? I : never;

declare module "." {
  interface Jobs {
    compute: (
      ps: ItineraryQuery["from"],
      pt: ItineraryQuery["to"],
      date: Date,
      settings: Partial<RAPTORRunSettings>,
    ) => DocumentType<dbComputeResult>["_id"];
  }
}

type DBJourney = (LabelBase | LabelFoot | LabelVehicle)[];
function journeyDBFormatter(j: NonNullable<ReturnType<SharedRAPTOR["getBestJourneys"]>[number]>): DBJourney {
  return j.map((label) => {
    if ("transfer" in label) {
      return {
        ...label,
        type: JourneyLabelType.Foot,
      } satisfies LabelFoot;
    }

    if ("route" in label) {
      if (typeof label.route.id === "string") throw new Error("Invalid route to retrieve.");

      return {
        ...label,
        route: label.route.id,
        type: JourneyLabelType.Vehicle,
      } satisfies LabelVehicle;
    }

    return {
      ...label,
      type: JourneyLabelType.Base,
    } satisfies LabelBase;
  });
}

// Acts as a factory
export default function (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) {
  let RAPTORData = SharedRAPTORData.makeFromInternalData(data);
  let RAPTORInstance = new SharedRAPTOR(RAPTORData);

  const updateData = (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) => {
    RAPTORData = SharedRAPTORData.makeFromInternalData(data);
    RAPTORInstance = new SharedRAPTOR(RAPTORData);
  };

  const init = (async (app: BaseApplication) => {
    const dataDB = await initDB(app, app.config.computeDB);
    const resultModel = ResultModelInit(dataDB);

    const sourceDataDB = await initDB(app, app.config.sourceDB);
    const stops = stopsModelInit(sourceDataDB);

    // https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#-sort----limit-coalescence
    const maxStopId = (await stops.find({}, { _id: 1 }).sort({ _id: -1 }).limit(1))[0]?._id ?? 0;

    return async (job) => {
      const {
        data: [ps, pt, departureDateStr, reqSettings],
      } = job;
      let childrenResults:
        | Awaited<ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>>[string][]
        | null = null;

      const attachStops = new Map<number, Stop<number, number>>();

      let psId: Parameters<typeof RAPTORData.stops.get>[0] = -1;
      // Need to insert point to be used as starting point in RAPTOR
      if (ps.type === TBMEndpoints.Addresses) {
        childrenResults = Object.values(await job.getChildrenValues<JobResult<"computeFpOTA">>());

        // Must have been computing inside children jobs
        const childrenResultPs = childrenResults.find((cr) => cr.alias === "ps")?.distances;
        if (!childrenResultPs) throw new Error("Missing pre-computation for ps");

        const psIdNumber = maxStopId + 1;

        attachStops.set(psIdNumber, {
          id: psIdNumber,
          connectedRoutes: [],
          transfers: Object.keys(childrenResultPs).map((k) => {
            const sId = parseInt(k);

            return { to: sId, length: childrenResultPs[sId] };
          }),
        });

        Object.keys(childrenResultPs).forEach((k) => {
          const sId = parseInt(k);

          attachStops.set(sId, {
            id: sId,
            connectedRoutes: [],
            transfers: [{ to: psIdNumber, length: childrenResultPs[sId] }],
          });
        });

        psId = SharedRAPTORData.serializeId(psIdNumber);
      } else psId = (await stops.findOne({ coords: ps.coords }))?._id ?? -1;

      if (psId === -1) throw new Error("Cannot find ps");

      let ptId: Parameters<typeof RAPTORData.stops.get>[0] = -1;
      // Need to insert point to be used as target point in RAPTOR
      if (pt.type === TBMEndpoints.Addresses) {
        childrenResults ??= Object.values(await job.getChildrenValues<JobResult<"computeFpOTA">>());

        // Must have been computing inside children jobs
        const childrenResultPt = childrenResults.find((cr) => cr.alias === "pt")?.distances;
        if (!childrenResultPt) throw new Error("Missing pre-computation for pt");

        const ptIdNumber = maxStopId + 2;

        attachStops.set(ptIdNumber, {
          id: ptIdNumber,
          connectedRoutes: [],
          transfers: Object.keys(childrenResultPt).map((k) => {
            const sId = parseInt(k);

            return { to: sId, length: childrenResultPt[sId] };
          }),
        });

        Object.keys(childrenResultPt).forEach((k) => {
          const sId = parseInt(k);

          const alreadyAdded = attachStops.get(sId);

          attachStops.set(sId, {
            id: sId,
            connectedRoutes: [],
            transfers:
              // Merge transfers
              [...(alreadyAdded?.transfers ?? []), { to: ptIdNumber, length: childrenResultPt[sId] }],
          });
        });

        ptId = SharedRAPTORData.serializeId(ptIdNumber);
      } else ptId = (await stops.findOne({ coords: pt.coords }))?._id ?? -1;
      if (ptId === -1) throw new Error("Cannot find pt");

      RAPTORData.attachData(Array.from(attachStops.values()), []);

      // Convert to para-specific data (pointers)
      const convertedPs = typeof psId === "string" ? psId : RAPTORData.stopPointerFromId(psId);
      if (!convertedPs) throw new Error(`Invalid ps ${psId}`);

      const convertedPt = typeof ptId === "string" ? ptId : RAPTORData.stopPointerFromId(ptId);
      if (!convertedPt) throw new Error(`Invalid pt ${ptId}`);

      const settings = withDefaults(reqSettings, defaultRAPTORRunSettings);
      // String because stringified by Redis
      const departureDate = new Date(departureDateStr);

      RAPTORInstance.run(convertedPs, convertedPt, departureDate.getTime(), settings);

      const bestJourneys = RAPTORInstance.getBestJourneys(convertedPt)
        .filter((j): j is NonNullable<ReturnType<typeof RAPTORInstance.getBestJourneys>[number]> => !!j)
        .map((j) =>
          j.map((l) => ({
            ...l,
            // Convert back pointers to stop ids
            ...("boardedAt" in l ? { boardedAt: RAPTORData.stops.get(l.boardedAt)!.id } : {}),
            ...("transfer" in l
              ? {
                  transfer: {
                    ...l.transfer,
                    to: RAPTORData.stops.get(l.transfer.to)!.id,
                  },
                }
              : {}),
          })),
        );

      if (!bestJourneys.length) throw new Error("No journey found");

      // Keep only fastest journey & shortest journey
      const fastestJourney = bestJourneys.at(-1)!;
      const shortestJourney = bestJourneys.reduce(
        (acc, v) => (acc.length < v.length ? acc : v),
        bestJourneys[0],
      );

      const { _id } = await resultModel.create({
        from:
          ps.type === TBMEndpoints.Addresses
            ? ({
                type: LocationType.Address,
                id: ps.id,
              } satisfies LocationAddress)
            : ps.type === TBMEndpoints.Stops
              ? ({ type: LocationType.TBM, id: ps.id } satisfies LocationTBM)
              : ({ type: LocationType.SNCF, id: ps.id } satisfies LocationSNCF),
        to:
          pt.type === TBMEndpoints.Addresses
            ? ({
                type: LocationType.Address,
                id: pt.id,
              } satisfies LocationAddress)
            : pt.type === TBMEndpoints.Stops
              ? ({ type: LocationType.TBM, id: pt.id } satisfies LocationTBM)
              : ({ type: LocationType.SNCF, id: pt.id } satisfies LocationSNCF),
        journeys: [fastestJourney, shortestJourney].map((j) => journeyDBFormatter(j)),
        settings,
      });

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}
