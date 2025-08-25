import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import ResultModelInit, {
  Journey,
  JourneyStepBase,
  JourneyStepFoot,
  JourneyStepType,
  JourneyStepVehicle,
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
import {
  Criterion,
  InternalTimeInt,
  McSharedRAPTOR,
  RAPTORRunSettings,
  SharedID,
  SharedRAPTORData,
  bufferTime,
  sharedTimeIntOrderLow,
} from "raptor";
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

type DBJourney = Omit<Journey, "steps"> & {
  steps: (JourneyStepBase | JourneyStepFoot | JourneyStepVehicle)[];
};
function journeyDBFormatter<V, CA extends [V, string][]>(
  journey: NonNullable<ReturnType<McSharedRAPTOR<InternalTimeInt, V, CA>["getBestJourneys"]>[number]>[number],
): DBJourney {
  return {
    steps: journey.map((js) => {
      if ("transfer" in js) {
        return {
          ...js,
          time: js.label.time,
          type: JourneyStepType.Foot,
        } satisfies JourneyStepFoot;
      }

      if ("route" in js) {
        if (typeof js.route.id === "string") throw new Error("Invalid route to retrieve.");

        return {
          ...js,
          time: js.label.time,
          route: js.route.id,
          type: JourneyStepType.Vehicle,
        } satisfies JourneyStepVehicle;
      }

      return {
        ...js,
        time: js.label.time,
        type: JourneyStepType.Base,
      } satisfies JourneyStepBase;
    }),
    criteria: journey[0].label.criteria.map(({ name }) => ({
      name,
      value: journey.at(-1)!.label.value(name),
    })),
  };
}

// Acts as a factory
export default function (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[1]) {
  let RAPTORData = SharedRAPTORData.makeFromInternalData(sharedTimeIntOrderLow, data);
  let McRAPTORInstance = new McSharedRAPTOR<InternalTimeInt, number, [[number, "bufferTime"]]>(RAPTORData, [
    bufferTime as Criterion<InternalTimeInt, SharedID, SharedID, number, "bufferTime">,
  ]);
  let maxStopId = Array.from(RAPTORData.stops).reduce(
    (acc, [id]) => (typeof id === "number" && id > acc ? id : acc),
    0,
  );

  const updateData = (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[1]) => {
    RAPTORData = SharedRAPTORData.makeFromInternalData(sharedTimeIntOrderLow, data);
    McRAPTORInstance = new McSharedRAPTOR<InternalTimeInt, number, [[number, "bufferTime"]]>(RAPTORData, [
      bufferTime as Criterion<InternalTimeInt, SharedID, SharedID, number, "bufferTime">,
    ]);
    maxStopId = Array.from(RAPTORData.stops).reduce(
      (acc, [_, stop]) => (typeof stop.id === "number" && stop.id > acc ? stop.id : acc),
      0,
    );
  };

  const init = (async (app: BaseApplication) => {
    const dataDB = await initDB(app, app.config.computeDB);
    const resultModel = ResultModelInit(dataDB);

    const sourceDataDB = await initDB(app, app.config.sourceDB);
    const stops = stopsModelInit(sourceDataDB);

    const psIdNumber = maxStopId + 1;
    const ptIdNumber = maxStopId + 2;

    return async (job) => {
      const {
        data: [ps, pt, departureDateStr, reqSettings],
      } = job;
      let childrenResults:
        | Awaited<ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA" | "computeFp">>>>[string][]
        | null = null;

      const attachedStops = new Map<
        keyof Awaited<
          ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>
        >[string]["distances"],
        Parameters<SharedRAPTORData<InternalTimeInt>["attachStops"]>[0][number]
      >();

      let psId: Parameters<typeof RAPTORData.stops.get>[0] = -1;
      // Need to insert point to be used as starting point in RAPTOR
      if (ps.type === TBMEndpoints.Addresses) {
        childrenResults = Object.values(await job.getChildrenValues());

        // Must have been computed inside children jobs
        const childrenResultPs = childrenResults.find(
          (cr): cr is JobResult<"computeFpOTA"> => "distances" in cr && cr.alias === "ps",
        )?.distances;
        if (!childrenResultPs) throw new Error("Missing pre-computation for ps");

        attachedStops.set(psIdNumber, [
          psIdNumber,
          [],
          Object.keys(childrenResultPs).map((k) => {
            const sId = parseInt(k);

            return { to: sId, length: childrenResultPs[sId] };
          }),
        ]);

        Object.keys(childrenResultPs).forEach((k) => {
          const sId = parseInt(k);

          attachedStops.set(sId, [sId, [], [{ to: psIdNumber, length: childrenResultPs[sId] }]]);
        });

        psId = SharedRAPTORData.serializeId(psIdNumber);
      } else psId = (await stops.findOne({ coords: ps.coords }))?._id ?? -1;

      if (psId === -1) throw new Error("Cannot find ps");

      let ptId: Parameters<typeof RAPTORData.stops.get>[0] = -1;
      // Need to insert point to be used as target point in RAPTOR
      if (pt.type === TBMEndpoints.Addresses) {
        childrenResults ??= Object.values(await job.getChildrenValues());

        // Must have been computed inside children jobs
        const childrenResultPt = childrenResults.find(
          (cr): cr is JobResult<"computeFpOTA"> => "distances" in cr && cr.alias === "pt",
        )?.distances;
        if (!childrenResultPt) throw new Error("Missing pre-computation for pt");
        attachedStops.set(ptIdNumber, [
          ptIdNumber,
          [],
          Object.keys(childrenResultPt).map((k) => {
            const sId = parseInt(k);

            return { to: sId, length: childrenResultPt[sId] };
          }),
        ]);

        Object.keys(childrenResultPt).forEach((k) => {
          const sId = parseInt(k);

          const alreadyAttached = attachedStops.get(sId);

          attachedStops.set(sId, [
            sId,
            [],
            // Merge transfers
            [...(alreadyAttached?.[2] ?? []), { to: ptIdNumber, length: childrenResultPt[sId] }],
          ]);
        });

        ptId = SharedRAPTORData.serializeId(ptIdNumber);
      } else ptId = (await stops.findOne({ coords: pt.coords }))?._id ?? -1;
      if (ptId === -1) throw new Error("Cannot find pt");

      if (ps.type === TBMEndpoints.Addresses && pt.type === TBMEndpoints.Addresses) {
        // Must have been computed inside children jobs
        const psToPt = (childrenResults ??= Object.values(await job.getChildrenValues())).find(
          (cr): cr is JobResult<"computeFp"> => "distance" in cr,
        )?.distance;
        if (!psToPt) throw new Error("Missing pre-computation for ps-to-pt");

        if (psToPt < Infinity) {
          // Add foot path directly from ps to pt and vice-versa
          const attachedToPs = attachedStops.get(psIdNumber);
          attachedStops.set(psIdNumber, [
            psIdNumber,
            [],
            [...(attachedToPs?.[2] ?? []), { to: ptIdNumber, length: psToPt }],
          ]);

          const attachedToPt = attachedStops.get(ptIdNumber);
          attachedStops.set(ptIdNumber, [
            ptIdNumber,
            [],
            [...(attachedToPt?.[2] ?? []), { to: psIdNumber, length: psToPt }],
          ]);
        }
      }

      RAPTORData.attachStops(Array.from(attachedStops.values()));

      const settings = withDefaults(reqSettings, defaultRAPTORRunSettings);
      // String because stringified by Redis
      const departureDate = new Date(departureDateStr);

      McRAPTORInstance.run(psId, ptId, [departureDate.getTime(), departureDate.getTime()], settings);
      const bestJourneys = McRAPTORInstance.getBestJourneys(ptId);
      /* bestJourneys.forEach((roundJourneys) =>
        roundJourneys.forEach((j) =>
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
          ).reduceRight((_, js, i) => {
            // With side effect on l

            const nextJourneyStep = j[i + 1];
            if (!nextJourneyStep) return null;

            const computedTime =
              "transfer" in nextJourneyStep
                ? nextJourneyStep.label.time -
                  // m / (m/s) * 1e3 => ms
                  (nextJourneyStep.transfer.length / settings.walkSpeed) * 1e3
                : "route" in nextJourneyStep
                  ? nextJourneyStep.route.departureTime(
                      nextJourneyStep.tripIndex,
                      nextJourneyStep.route.stops.indexOf(nextJourneyStep.boardedAt),
                    )
                  : // Should never reach here
                    0;

            if (computedTime > js.label.time) j[i] = { ...js, time: computedTime };

            return null;
          }, null),
        ),
       ); */

      if (bestJourneys.every((journeys) => journeys.length === 0)) throw new Error("No journey found");

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
        departureTime: departureDate,
        journeys: bestJourneys
          .flat()
          // Sort by arrival time
          .sort((a, b) => sharedTimeIntOrderLow.strict.order(a.at(-1)!.label.time, b.at(-1)!.label.time))
          .map(journeyDBFormatter),
        settings,
      });

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}
