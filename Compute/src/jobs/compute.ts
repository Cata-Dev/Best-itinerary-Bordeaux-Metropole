import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import ResultModelInit, {
  JourneyStepType,
  JourneyStepBase,
  JourneyStepFoot,
  JourneyStepVehicle,
  Journey,
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
import { bufferTime, McSharedRAPTOR, RAPTORRunSettings } from "raptor";
import { SharedRAPTORData, Stop } from "raptor";
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
function journeyDBFormatter<C extends string[]>(
  journey: NonNullable<ReturnType<McSharedRAPTOR<C>["getBestJourneys"]>[number]>[number],
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
export default function (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) {
  let RAPTORData = SharedRAPTORData.makeFromInternalData(data);
  let McRAPTORInstance = new McSharedRAPTOR<["bufferTime"]>(RAPTORData, [bufferTime]);

  const updateData = (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) => {
    RAPTORData = SharedRAPTORData.makeFromInternalData(data);
    McRAPTORInstance = new McSharedRAPTOR<["bufferTime"]>(RAPTORData, [bufferTime]);
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
        | Awaited<ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA" | "computeFp">>>>[string][]
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
        childrenResults = Object.values(await job.getChildrenValues());

        // Must have been computed inside children jobs
        const childrenResultPs = childrenResults.find(
          (cr): cr is JobResult<"computeFpOTA"> => "distances" in cr && cr.alias === "ps",
        )?.distances;
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
        childrenResults ??= Object.values(await job.getChildrenValues());

        // Must have been computed inside children jobs
        const childrenResultPt = childrenResults.find(
          (cr): cr is JobResult<"computeFpOTA"> => "distances" in cr && cr.alias === "pt",
        )?.distances;
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

      if (ps.type === TBMEndpoints.Addresses && pt.type === TBMEndpoints.Addresses) {
        // Must have been computed inside children jobs
        const psToPt = (childrenResults ??= Object.values(await job.getChildrenValues())).find(
          (cr): cr is JobResult<"computeFp"> => "distance" in cr,
        )?.distance;
        if (!psToPt) throw new Error("Missing pre-computation for ps-to-pt");

        if (psToPt < Infinity) {
          // Add foot path directly from ps to pt and vice-versa
          const attachedToPs = attachStops.get(psIdNumber);
          attachStops.set(psIdNumber, {
            id: psIdNumber,
            connectedRoutes: [],
            transfers: [...(attachedToPs?.transfers ?? []), { to: ptIdNumber, length: psToPt }],
          });

          const attachedToPt = attachStops.get(ptIdNumber);
          attachStops.set(ptIdNumber, {
            id: ptIdNumber,
            connectedRoutes: [],
            transfers: [...(attachedToPt?.transfers ?? []), { to: psIdNumber, length: psToPt }],
          });
        }
      }

      RAPTORData.attachData(Array.from(attachStops.values()), []);

      // Convert to para-specific data (pointers)
      const convertedPs = typeof psId === "string" ? psId : RAPTORData.stopPointerFromId(psId);
      if (!convertedPs) throw new Error(`Invalid ps ${psId}`);

      const convertedPt = typeof ptId === "string" ? ptId : RAPTORData.stopPointerFromId(ptId);
      if (!convertedPt) throw new Error(`Invalid pt ${ptId}`);

      const settings = withDefaults(reqSettings, defaultRAPTORRunSettings);
      // String because stringified by Redis
      const departureDate = new Date(departureDateStr);

      McRAPTORInstance.run(convertedPs, convertedPt, departureDate.getTime(), settings);

      const bestJourneys = McRAPTORInstance.getBestJourneys(convertedPt).filter(
        (roundJourneys): roundJourneys is NonNullable<typeof roundJourneys> => !!roundJourneys,
      );
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

      // Need to do this in a 2nd time to prevent resolving ids earlier than expected
      const bestJourneysResolved = bestJourneys.map((roundJourneys) =>
        roundJourneys.map((journeys) =>
          journeys.map(
            (js) =>
              ({
                ...js,
                ...("boardedAt" in js ? { boardedAt: RAPTORData.stops.get(js.boardedAt)!.id } : {}),
                ...("transfer" in js
                  ? {
                      transfer: {
                        to: RAPTORData.stops.get(js.transfer.to)!.id,
                        length: js.transfer.length,
                      },
                    }
                  : {}),
              }) as (typeof bestJourneys)[number][number][number],
          ),
        ),
      );

      if (!bestJourneysResolved.length) throw new Error("No journey found");

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
        journeys: bestJourneysResolved.flat().map((journey) => journeyDBFormatter(journey)),
        settings,
      });

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}
