import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import ResultModelInit, {
  AddressPoint,
  Journey,
  JourneyStepBase,
  JourneyStepFoot,
  JourneyStepType,
  JourneyStepVehicle,
  LocationAddress,
  LocationSNCF,
  LocationTBM,
  PointType,
  RouteType,
  SNCFRoute,
  SNCFStopPoint,
  TBMRoute,
  TBMStopPoint,
  dbComputeResult,
} from "@bibm/data/models/Compute/result.model";
import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import SNCFStopsModelInit from "@bibm/data/models/SNCF/SNCF_stops.model";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBMStopsModelInit from "@bibm/data/models/TBM/TBM_stops.model";
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
import type { JobData, JobFn, JobResult } from ".";
import type { BaseApplication } from "../base";
import { withDefaults } from "../utils";
import { ProviderRouteId, ProviderStopId, makeComputeData } from "./preCompute/compute";
import { Providers, makeMapId } from "./preCompute/utils";

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

function unmapRAPTORStop(
  ps: [number, JobData<"compute">[0]["id"]],
  pt: [number, JobData<"compute">[1]["id"]],
  unmapStopId: ReturnType<typeof makeMapId<ProviderStopId>>[1],
  mappedPointId: Extract<
    ReturnType<McSharedRAPTOR<InternalTimeInt, never, never>["getBestJourneys"]>[number][number][number],
    { boardedAt: unknown }
  >["boardedAt"],
) {
  // If mappedPointId is a string, it must have been ps or pt (which have been serialized)
  if (typeof mappedPointId === "string") {
    const stopInt = parseInt(mappedPointId.substring(3));
    const addressId = stopInt === ps[0] ? ps[1] : stopInt === pt[0] ? pt[1] : null;
    return addressId === null
      ? null
      : ({
          type: PointType.Address,
          id: addressId,
        } satisfies AddressPoint);
  }

  const stop = unmapStopId(mappedPointId);
  if (!stop) return null;

  return stop[1] === Providers.TBM
    ? ({
        type: PointType.TBMStop,
        id: stop[0],
      } satisfies TBMStopPoint)
    : stop[1] === Providers.SNCF
      ? ({
          type: PointType.SNCFStop,
          id: stop[0],
        } satisfies SNCFStopPoint)
      : null;
}

type DBJourney = Omit<Journey, "steps"> & {
  steps: (JourneyStepBase | JourneyStepFoot | JourneyStepVehicle)[];
};
function journeyDBFormatter<V, CA extends [V, string][]>(
  ps: [number, JobData<"compute">[0]["id"]],
  pt: [number, JobData<"compute">[1]["id"]],
  unmapStopId: ReturnType<typeof makeMapId<ProviderStopId>>[1],
  unmapRouteId: ReturnType<typeof makeMapId<ProviderRouteId>>[1],
  journey: ReturnType<McSharedRAPTOR<InternalTimeInt, V, CA>["getBestJourneys"]>[number][number],
): DBJourney {
  return {
    steps: journey.map((js) => {
      if ("transfer" in js || "route" in js) {
        const boardedAt = unmapRAPTORStop(ps, pt, unmapStopId, js.boardedAt);
        if (boardedAt === null)
          throw new Error(`Unable to unmap RAPTOR stop (boarded at) with ID ${js.boardedAt}`);

        if ("transfer" in js) {
          const to = unmapRAPTORStop(ps, pt, unmapStopId, js.transfer.to);
          if (to === null)
            throw new Error(`Unable to unmap RAPTOR stop (transfer target) with ID ${js.transfer.to}`);

          return {
            boardedAt,
            time: js.label.time,
            transfer: { to, length: js.transfer.length },
            type: JourneyStepType.Foot,
          } satisfies JourneyStepFoot;
        }

        if ("route" in js) {
          if (typeof js.route.id === "string") throw new Error("Invalid route to retrieve.");
          const unmappedRoute = unmapRouteId(js.route.id);
          if (unmappedRoute === null) throw new Error(`Unable to unmap RAPTOR route with ID ${js.route.id}`);

          const route =
            unmappedRoute[1] === Providers.TBM
              ? ({
                  type: RouteType.TBM,
                  id: unmappedRoute[0] as number,
                } satisfies TBMRoute)
              : unmappedRoute[1] === Providers.SNCF
                ? ({
                    type: RouteType.SNCF,
                    id: unmappedRoute[0] as string,
                  } satisfies SNCFRoute)
                : null;
          if (!route) throw new Error(`Unexpected route provider ${unmappedRoute[1]}`);

          return {
            boardedAt,
            time: js.label.time,
            tripIndex: js.tripIndex,
            route,
            type: JourneyStepType.Vehicle,
          } satisfies JourneyStepVehicle;
        }
      }

      return {
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
export default function (data: ReturnType<makeComputeData>) {
  let RAPTORData = SharedRAPTORData.makeFromInternalData(sharedTimeIntOrderLow, data.RAPTORInternalData);
  let McRAPTORInstance = new McSharedRAPTOR<InternalTimeInt, number, [[number, "bufferTime"]]>(RAPTORData, [
    bufferTime as Criterion<InternalTimeInt, SharedID, SharedID, number, "bufferTime">,
  ]);
  let stopsMapping = data.stopsMapping;
  let routesMapping = data.routesMapping;
  let maxStopId = Math.round(
    Array.from(RAPTORData.stops).reduce((acc, [id]) => (typeof id === "number" && id > acc ? id : acc), 0) *
      1.5,
  );
  let [mapStopId, unmapStopId] = makeMapId(...stopsMapping);
  let [_, unmapRouteId] = makeMapId(...routesMapping);

  const updateData = (data: ReturnType<makeComputeData>) => {
    RAPTORData = SharedRAPTORData.makeFromInternalData(sharedTimeIntOrderLow, data.RAPTORInternalData);
    McRAPTORInstance = new McSharedRAPTOR<InternalTimeInt, number, [[number, "bufferTime"]]>(RAPTORData, [
      bufferTime as Criterion<InternalTimeInt, SharedID, SharedID, number, "bufferTime">,
    ]);
    stopsMapping = data.stopsMapping;
    routesMapping = data.routesMapping;
    maxStopId = Math.round(
      Array.from(RAPTORData.stops).reduce(
        (acc, [_, stop]) => (typeof stop.id === "number" && stop.id > acc ? stop.id : acc),
        0,
      ) * 1.5,
    );
    [mapStopId, unmapStopId] = makeMapId(...stopsMapping);
    [_, unmapRouteId] = makeMapId(...routesMapping);
  };

  const init = (async (app: BaseApplication) => {
    const dataDB = await initDB(app, app.config.computeDB);
    const resultModel = ResultModelInit(dataDB);

    const sourceDataDB = await initDB(app, app.config.sourceDB);
    const TBMStopsModel = TBMStopsModelInit(sourceDataDB);
    const SNCFStopsModel = SNCFStopsModelInit(sourceDataDB);

    return async (job) => {
      const {
        data: [ps, pt, departureDateStr, reqSettings],
      } = job;
      const psIdNumber = maxStopId + 1;
      const ptIdNumber = maxStopId + 2;

      let childrenResults:
        | Awaited<ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA" | "computeFp">>>>[string][]
        | null = null;

      const attachedStops = new Map<
        keyof Awaited<
          ReturnType<typeof job.getChildrenValues<JobResult<"computeFpOTA">>>
        >[string]["distances"],
        Parameters<SharedRAPTORData<InternalTimeInt>["attachStops"]>[0][number]
      >();

      // Source point ID generation
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

            return { to: mapStopId(Providers.TBM, sId), length: childrenResultPs[sId] };
          }),
        ]);

        Object.keys(childrenResultPs).forEach((k) => {
          const sId = parseInt(k);

          attachedStops.set(mapStopId(Providers.TBM, sId), [
            mapStopId(Providers.TBM, sId),
            [],
            [{ to: psIdNumber, length: childrenResultPs[sId] }],
          ]);
        });

        psId = SharedRAPTORData.serializeId(psIdNumber);
      } else if (ps.type === TBMEndpoints.Stops) {
        const stopId = (await TBMStopsModel.findOne({ coords: ps.coords }))?._id ?? -1;
        if (stopId === -1) throw new Error("Cannot find ps");

        psId = mapStopId(Providers.TBM, stopId);
      } else if (ps.type === SNCFEndpoints.Stops) {
        const stopId = (await SNCFStopsModel.findOne({ coords: ps.coords }))?._id ?? -1;
        if (stopId === -1) throw new Error("Cannot find ps");

        psId = mapStopId(Providers.SNCF, stopId);
      } else throw new Error(`Unknown location type ${JSON.stringify(ps)}`);

      // Target point ID generation
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

            return { to: mapStopId(Providers.TBM, sId), length: childrenResultPt[sId] };
          }),
        ]);

        Object.keys(childrenResultPt).forEach((k) => {
          const sId = parseInt(k);

          const alreadyAttached = attachedStops.get(sId);

          attachedStops.set(mapStopId(Providers.TBM, sId), [
            mapStopId(Providers.TBM, sId),
            [],
            // Merge transfers
            [...(alreadyAttached?.[2] ?? []), { to: ptIdNumber, length: childrenResultPt[sId] }],
          ]);
        });

        ptId = SharedRAPTORData.serializeId(ptIdNumber);
      } else if (pt.type === TBMEndpoints.Stops) {
        const stopId = (await TBMStopsModel.findOne({ coords: pt.coords }))?._id ?? -1;
        if (stopId === -1) throw new Error("Cannot find pt");

        ptId = mapStopId(Providers.TBM, stopId);
      } else if (pt.type === SNCFEndpoints.Stops) {
        const stopId = (await SNCFStopsModel.findOne({ coords: pt.coords }))?._id ?? -1;
        if (stopId === -1) throw new Error("Cannot find pt");

        ptId = mapStopId(Providers.SNCF, stopId);
      } else throw new Error(`Unknown location type ${JSON.stringify(pt)}`);

      if (ps.type === TBMEndpoints.Addresses && pt.type === TBMEndpoints.Addresses) {
        // Must have been computed inside children jobs
        const psToPt = (childrenResults ??= Object.values(await job.getChildrenValues())).find(
          (cr): cr is JobResult<"computeFp"> => "distance" in cr,
        )?.distance;
        if (!psToPt) throw new Error("Missing pre-computation for ps-to-pt");

        if (psToPt < Infinity) {
          // Add foot path directly from ps to pt and vice-versa
          const attachedToPs = attachedStops.get(psIdNumber);
          if (attachedToPs) attachedToPs[2].push({ to: ptIdNumber, length: psToPt });
          else attachedStops.set(psIdNumber, [psIdNumber, [], [{ to: ptIdNumber, length: psToPt }]]);

          const attachedToPt = attachedStops.get(ptIdNumber);
          if (attachedToPt) attachedToPt[2].push({ to: psIdNumber, length: psToPt });
          else attachedStops.set(ptIdNumber, [ptIdNumber, [], [{ to: psIdNumber, length: psToPt }]]);
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
                type: PointType.Address,
                id: ps.id,
              } satisfies LocationAddress)
            : ps.type === TBMEndpoints.Stops
              ? ({ type: PointType.TBMStop, id: ps.id } satisfies LocationTBM)
              : ({ type: PointType.SNCFStop, id: ps.id } satisfies LocationSNCF),
        to:
          pt.type === TBMEndpoints.Addresses
            ? ({
                type: PointType.Address,
                id: pt.id,
              } satisfies LocationAddress)
            : pt.type === TBMEndpoints.Stops
              ? ({ type: PointType.TBMStop, id: pt.id } satisfies LocationTBM)
              : ({ type: PointType.SNCFStop, id: pt.id } satisfies LocationSNCF),
        departureTime: departureDate,
        journeys: bestJourneys
          .flat()
          // Sort by arrival time
          .sort((a, b) => sharedTimeIntOrderLow.strict.order(a.at(-1)!.label.time, b.at(-1)!.label.time))
          .map((journey) =>
            journeyDBFormatter([psIdNumber, ps.id], [ptIdNumber, pt.id], unmapStopId, unmapRouteId, journey),
          ),
        settings,
      });

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}

export { journeyDBFormatter, unmapRAPTORStop };
