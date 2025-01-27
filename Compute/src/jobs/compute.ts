import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

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
} from "@bibm/data/models/Compute/result.model";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import stopsModelInit from "@bibm/data/models/TBM/TBM_stops.model";
import { defaultRAPTORRunSettings } from "@bibm/data/values/RAPTOR/index";
import { JourneyQuery } from "@bibm/server";
import { DocumentType } from "@typegoose/typegoose";
import type { RAPTORRunSettings } from "raptor";
import SharedRAPTOR from "raptor/lib/shared";
import { SharedRAPTORData } from "raptor/lib/SharedStructures";
import { Stop } from "raptor/lib/Structures";
import type { JobFn, JobResult } from ".";
import type { BaseApplication } from "../base";
import { withDefaults } from "../utils";

declare module "." {
  interface Jobs {
    compute: (
      ps: Extract<JourneyQuery, { from: unknown }>["from"],
      pt: Extract<JourneyQuery, { to: unknown }>["to"],
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
    const psIdNumber = maxStopId + 1;
    const ptIdNumber = maxStopId + 2;

    return async (job) => {
      const {
        data: [ps, pt, departureDateStr, reqSettings],
      } = job;
      let childrenResults:
        | Awaited<ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>>[string][]
        | null = null;

      const attachStops = new Map<
        keyof Awaited<
          ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>
        >[string]["distances"],
        Stop<
          keyof Awaited<
            ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>
          >[string]["distances"],
          number
        >
      >();

      let psId: Parameters<typeof RAPTORData.stops.get>[0] = -1;
      // Need to insert point to be used as starting point in RAPTOR
      if (ps.type === TBMEndpoints.Addresses) {
        childrenResults = Object.values(await job.getChildrenValues<JobResult<"computeFpOTA">>());

        // Must have been computing inside children jobs
        const childrenResultPs = childrenResults.find((cr) => cr.alias === "ps")?.distances;
        if (!childrenResultPs) throw new Error("Missing pre-computation for ps");

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

      const bestJourneys = RAPTORInstance.getBestJourneys(convertedPt).filter(
        (j): j is NonNullable<ReturnType<typeof RAPTORInstance.getBestJourneys>[number]> => !!j,
      );
      bestJourneys.forEach((j) =>
        // Optimize journey : delay foot transfers at beginning of journey
        (
          j.slice(
            0,
            (() => {
              // Start at second label, count first
              let count = 1;
              for (let i = count; i < j.length && "transfer" in j[i]; i++) count++;

              return count;
            })(),
          ) as Extract<(typeof j)[number], { transfer: unknown }>[]
        ).reduceRight((_, l, i) => {
          // With side effect on l

          const nextLabel = j[i + 1];
          if (!nextLabel) return null;

          const computedTime =
            "transfer" in nextLabel
              ? nextLabel.time -
                // m / (m/s) * 1e3 => ms
                (nextLabel.transfer.length / settings.walkSpeed) * 1e3
              : "route" in nextLabel
                ? nextLabel.route.departureTime(
                    nextLabel.tripIndex,
                    nextLabel.route.stops.indexOf(nextLabel.boardedAt),
                  )
                : // Should never reach here
                  0;

          if (computedTime > l.time) j[i] = { ...l, time: computedTime };

          return null;
        }, null),
      );

      // Need to do this in a 2nd time to prevent resolving ids earlier than expected
      const bestJourneysResolved = bestJourneys.map((j) =>
        j.map(
          (l) =>
            ({
              ...l,
              ...("boardedAt" in l ? { boardedAt: RAPTORData.stops.get(l.boardedAt)!.id } : {}),
              ...("transfer" in l
                ? {
                    transfer: {
                      to: RAPTORData.stops.get(l.transfer.to)!.id,
                      length: l.transfer.length,
                    },
                  }
                : {}),
            }) as (typeof bestJourneys)[number][number],
        ),
      );

      if (!bestJourneysResolved.length) throw new Error("No journey found");

      // Keep only fastest journey & shortest journey
      const fastestJourney = bestJourneysResolved.at(-1)!;
      const shortestJourney = bestJourneysResolved.reduce(
        (acc, v) => (acc.length < v.length ? acc : v),
        bestJourneysResolved[0],
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
        journeys: [fastestJourney, ...(shortestJourney === fastestJourney ? [] : [shortestJourney])].map(
          (j) => journeyDBFormatter(j),
        ),
        settings,
      });

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}
