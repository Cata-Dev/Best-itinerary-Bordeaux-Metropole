// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Logger } from "@bibm/common/logger";
import { UnpackRefType } from "@bibm/common/types";
import NonScheduledRoutesModelInit, { dbFootPaths } from "@bibm/data/models/TBM/NonScheduledRoutes.model";
import TBMScheduledRoutesModelInit, {
  dbTBM_ScheduledRoutes,
} from "@bibm/data/models/TBM/TBMScheduledRoutes.model";
import TBMSchedulesInit, { dbTBM_Schedules_rt } from "@bibm/data/models/TBM/TBM_schedules.model";
import TBMStopsModelInit, { dbTBM_Stops } from "@bibm/data/models/TBM/TBM_stops.model";
import { DocumentType } from "@typegoose/typegoose";
import { writeFileSync } from "node:fs";
import { sep } from "node:path";
import { parentPort } from "node:worker_threads";
import { RAPTORData as RAPTORDataClass, SharedRAPTORData, sharedTimeIntOrderLow, TimeScal } from "raptor";
import { preComputeLogger } from ".";
import { app } from "../../base";
import { initDB } from "../../utils/mongoose";
import { makeMapId, Providers } from "./utils";

/** DB Types */

// Stops
// TBM
const dbTBMStopProjection = { _id: 1 } satisfies Partial<Record<keyof dbTBM_Stops, 1>>;
type TBMStop = Pick<dbTBM_Stops, keyof typeof dbTBMStopProjection>;

// Schedules
// TBM
const dbTBMSchedulesProjection = { hor_theo: 1, hor_estime: 1, hor_app: 1 } satisfies Partial<
  Record<keyof dbTBM_Schedules_rt, 1>
>;
type dbTBMScheduleRt = Pick<dbTBM_Schedules_rt, keyof typeof dbTBMSchedulesProjection>;

// Scheduled Routes
// TBM
const dbTBMScheduledRoutesProjection = { _id: 1, stops: 1, trips: 1 } satisfies Partial<
  Record<keyof dbTBM_ScheduledRoutes, 1>
>;
type dbTBMScheduledRoute = Pick<dbTBM_ScheduledRoutes, keyof typeof dbTBMScheduledRoutesProjection>;
interface TBMScheduledRoutesOverwritten /* extends dbTBM_ScheduledRoutes */ {
  _id: UnpackRefType<dbTBMScheduledRoute["_id"]>;
  stops: UnpackRefType<dbTBMScheduledRoute["stops"]>;
  trips: {
    // Not a Document because of lean
    schedules: dbTBMScheduleRt[];
  }[];
}
type TBMScheduledRoute = Omit<dbTBMScheduledRoute, keyof TBMScheduledRoutesOverwritten> &
  TBMScheduledRoutesOverwritten;

type ProviderRouteId = TBMScheduledRoute["_id"];
type ProviderStopId = TBMStop["_id"];

// Non Schedules Routes
const dbNonScheduledRoutesProjection = { from: 1, to: 1, distance: 1 } satisfies Partial<
  Record<keyof dbFootPaths, 1>
>;
type dbNonScheduledRoute = Pick<dbFootPaths, keyof typeof dbNonScheduledRoutesProjection>;
interface NonScheduledRoutesOverwritten extends dbNonScheduledRoute {
  from: UnpackRefType<dbNonScheduledRoute["from"]>;
  to: UnpackRefType<dbNonScheduledRoute["to"]>;
}
type NonScheduledRoute = Omit<dbNonScheduledRoute, keyof NonScheduledRoutesOverwritten> &
  NonScheduledRoutesOverwritten;

/** TODO: do not hardcode (or no limit) */
const NON_SCHEDULED_ROUTES_MAX_DIST = 3_000; // in meters

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed compute job data...");

    // DB-related stuff
    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const TBMStopsModel = TBMStopsModelInit(sourceDataDB);
    TBMSchedulesInit(sourceDataDB);
    const TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(sourceDataDB);
    const NonScheduledRoutesModel = NonScheduledRoutesModelInit(sourceDataDB);

    // Virtual IDs (stops routes) management

    const stopIdsMappingF = new Map<`${Providers}-${ProviderStopId}`, number>();
    const stopIdsMappingB = new Map<number, [ProviderStopId, Providers]>();
    const TBMStopsCount = Math.round((await TBMStopsModel.estimatedDocumentCount()) * 1.5);
    const stopIdsRanges = {
      [Providers.TBM]: [0, TBMStopsCount, 0],
    } satisfies Record<string, [number, number, number]>;
    const mapStopId = makeMapId(stopIdsRanges, stopIdsMappingF, stopIdsMappingB)[0];

    const routeIdsMappingF = new Map<`${Providers}-${ProviderRouteId}`, number>();
    const routeIdsMappingB = new Map<number, [ProviderRouteId, Providers]>();
    // Memoizing allows us to only remember backward mapping, forward mapping is stored inside memoize
    const TBMSRCount = Math.round((await TBMScheduledRoutesModel.estimatedDocumentCount()) * 1.5);
    const routeIdsRanges = {
      [Providers.TBM]: [0, TBMSRCount, 0],
    } satisfies Record<string, [number, number, number]>;
    const mapRouteId = makeMapId(routeIdsRanges, routeIdsMappingF, routeIdsMappingB)[0];

    // Non scheduled routes

    // Query must associate (s, from) AND (from, s) forall s in stops !
    const dbNonScheduledRoutes = (
      (await NonScheduledRoutesModel.find<DocumentType<NonScheduledRoute>>(
        { distance: { $lte: NON_SCHEDULED_ROUTES_MAX_DIST } },
        { ...dbNonScheduledRoutesProjection, _id: 0 },
      )
        .lean()
        .exec()) as NonScheduledRoute[]
    ).reduce<
      Map<number, ConstructorParameters<typeof RAPTORDataClass<unknown, number, number>>[1][number][2]>
    >((acc, { from: _from, to: _to, distance }) => {
      _from = mapStopId(Providers.TBM, _from);
      _to = mapStopId(Providers.TBM, _to);

      for (const [from, to] of [
        [_from, _to],
        [_to, _from],
      ]) {
        let stopNonScheduledRoutes = acc.get(from);
        if (!stopNonScheduledRoutes) {
          stopNonScheduledRoutes = [];
          acc.set(from, stopNonScheduledRoutes);
        }

        stopNonScheduledRoutes.push({ length: distance, to });
      }

      return acc;
    }, new Map());

    // TBM stops & routes

    const dbTBMScheduledRoutes = (
      (await TBMScheduledRoutesModel.find<DocumentType<TBMScheduledRoute>>({}, dbTBMScheduledRoutesProjection)
        // Add ability to use binary search
        .sort({ _id: 1 })
        .populate("trips.schedules", { ...dbTBMSchedulesProjection, _id: 0, __t: 0 })
        .lean()
        .exec()) as TBMScheduledRoute[]
    ).map(({ _id, stops, trips }) => ({
      _id,
      stops: stops.map((stop) => mapStopId(Providers.TBM, stop)),
      trips,
    }));

    const TBMStops = dbTBMScheduledRoutes.reduce<
      Map<
        number,
        [TBMScheduledRoute["_id"][], Exclude<ReturnType<(typeof dbNonScheduledRoutes)["get"]>, undefined>]
      >
    >(
      (acc, { _id: routeId, stops }) => {
        for (const stopId of stops) {
          let stop = acc.get(stopId);
          if (!stop) {
            stop = [[], dbNonScheduledRoutes.get(stopId) ?? []];
            acc.set(stopId, stop);
          }

          stop[0].push(mapRouteId(Providers.TBM, routeId));
        }

        return acc;
      },
      new Map(
        (
          (await TBMStopsModel.find<DocumentType<TBMStop>>(
            { coords: { $not: { $elemMatch: { $eq: Infinity } } } },
            dbTBMStopProjection,
          )
            .lean()
            .exec()) as TBMStop[]
        ).map(({ _id }) => {
          const mappedId = mapStopId(Providers.TBM, _id);

          return [mappedId, [[], dbNonScheduledRoutes.get(mappedId) ?? []]];
        }),
      ),
    );

    // Finally make RAPTOR data

    const data = [
      TBMStops.entries()
        .map(
          ([id, [connectedRoutes, nonScheduledRoutes]]) =>
            [id, connectedRoutes, nonScheduledRoutes] satisfies [unknown, unknown, unknown],
        )
        .toArray(),
      dbTBMScheduledRoutes.map(
        ({ _id, stops, trips }) =>
          [
            // Don't forget to finally map route ID! This call is memoized
            mapRouteId(Providers.TBM, _id),
            stops,
            trips.map(({ schedules }) =>
              // Make schedules intervals
              schedules.map((schedule) => {
                let theo = schedule.hor_theo.getTime() || TimeScal.MAX_SAFE;
                let estime = schedule.hor_estime.getTime() || schedule.hor_app.getTime() || TimeScal.MAX_SAFE;

                // Prevent upper bound to be MAX_SAFE
                if (theo < TimeScal.MAX_SAFE && estime === TimeScal.MAX_SAFE) estime = theo;
                if (estime < TimeScal.MAX_SAFE && theo === TimeScal.MAX_SAFE) theo = estime;

                const int = theo < estime ? [theo, estime] : [estime, theo];
                return [[int[0], int[1]] as const, [int[0], int[1]] as const] satisfies [unknown, unknown];
              }),
            ),
          ] satisfies [unknown, unknown, unknown],
      ),
    ] as const;

    writeFileSync(`${__dirname}/data.json`, JSON.stringify(data));

    const RAPTORData = SharedRAPTORData.makeFromRawData(sharedTimeIntOrderLow, ...data);

    await sourceDataDB.close();

    logger.info("Pre-computed compute job data made.");

    parentPort.postMessage({
      RAPTORInternalData: RAPTORData.internalData,
      stopsMapping: [stopIdsRanges, stopIdsMappingF, stopIdsMappingB],
      routesMapping: [routeIdsRanges, routeIdsMappingF, routeIdsMappingB],
    } satisfies ReturnType<makeComputeData>);
  })().catch((err) => logger.warn("During compute job data pre-computation", err));
}

type makeComputeData = () => {
  RAPTORInternalData: Parameters<typeof SharedRAPTORData.makeFromInternalData>[1];
  stopsMapping: Parameters<typeof makeMapId<ProviderStopId>>;
  routesMapping: Parameters<typeof makeMapId<ProviderRouteId>>;
};

export type { makeComputeData, ProviderRouteId, ProviderStopId };
