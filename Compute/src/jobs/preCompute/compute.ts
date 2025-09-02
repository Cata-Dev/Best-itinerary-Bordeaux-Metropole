// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { Logger } from "@bibm/common/logger";
import { UnpackRefType } from "@bibm/common/types";
import NonScheduledRoutesModelInit, { dbFootPaths } from "@bibm/data/models/Compute/NonScheduledRoutes.model";
import { Schedule } from "@bibm/data/models/Compute/types";
import SNCFScheduledRoutesModelInit, {
  dbSNCF_ScheduledRoutes,
} from "@bibm/data/models/SNCF/SNCFScheduledRoutes.model";
import SNCFStopsModelInit, { dbSNCF_Stops } from "@bibm/data/models/SNCF/SNCF_stops.model";
import TBMScheduledRoutesModelInit, {
  dbTBM_ScheduledRoutes,
} from "@bibm/data/models/TBM/TBMScheduledRoutes.model";
import TBMSchedulesInit from "@bibm/data/models/TBM/TBM_schedules.model";
import TBMStopsModelInit, { dbTBM_Stops } from "@bibm/data/models/TBM/TBM_stops.model";
import { DocumentType } from "@typegoose/typegoose";
import { sep } from "node:path";
import { parentPort } from "node:worker_threads";
import { RAPTORData as RAPTORDataClass, SharedRAPTORData, sharedTimeIntOrderLow } from "raptor";
import { preComputeLogger } from ".";
import { app } from "../../base";
import { initDB } from "../../utils/mongoose";
import { makeMapId, Providers } from "./utils";

/** DB Types */

// Stops
// TBM
const dbTBMStopProjection = { _id: 1 } satisfies Partial<Record<keyof dbTBM_Stops, 1>>;
type TBMStop = Pick<dbTBM_Stops, keyof typeof dbTBMStopProjection>;

// SNCF
const dbSNCFStopProjection = { _id: 1 } satisfies Partial<Record<keyof dbSNCF_Stops, 1>>;
type SNCFStop = Pick<dbSNCF_Stops, keyof typeof dbSNCFStopProjection>;

// Schedules
const schedulesProjection = { arr_int_hor: 1, dep_int_hor: 1 } satisfies Partial<Record<keyof Schedule, 1>>;
type dbSchedule = Pick<Schedule, keyof typeof schedulesProjection>;

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
    schedules: dbSchedule[];
  }[];
}
type TBMScheduledRoute = Omit<dbTBMScheduledRoute, keyof TBMScheduledRoutesOverwritten> &
  TBMScheduledRoutesOverwritten;

// SNCF
const dbSNCFScheduledRoutesProjection = { _id: 1, stops: 1, trips: 1 } satisfies Partial<
  Record<keyof dbSNCF_ScheduledRoutes, 1>
>;
type dbSNCFScheduledRoute = Pick<dbSNCF_ScheduledRoutes, keyof typeof dbSNCFScheduledRoutesProjection>;
interface SNCFScheduledRoutesOverwritten /* extends dbSNCF_ScheduledRoutes */ {
  stops: UnpackRefType<dbSNCFScheduledRoute["stops"]>;
  trips: {
    // Not a Document because of lean
    schedules: dbSchedule[];
  }[];
}
type SNCFScheduledRoute = Omit<dbSNCFScheduledRoute, keyof SNCFScheduledRoutesOverwritten> &
  SNCFScheduledRoutesOverwritten;

type ProviderRouteId = TBMScheduledRoute["_id"] | SNCFScheduledRoute["_id"];
// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
type ProviderStopId = TBMStop["_id"] | SNCFStop["_id"];

// Non Schedules Routes
const dbNonScheduledRoutesProjection = { from: 1, to: 1, distance: 1 } satisfies Partial<
  Record<keyof dbFootPaths, 1>
>;
type dbNonScheduledRoute = Pick<dbFootPaths, keyof typeof dbNonScheduledRoutesProjection>;

/** TODO: do not hardcode (or no limit) */
const NON_SCHEDULED_ROUTES_MAX_DIST = 3_000; // in meters

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed compute job data...");

    // DB-related stuff
    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const TBMStopsModel = TBMStopsModelInit(sourceDataDB);
    const SNCFStopsModel = SNCFStopsModelInit(sourceDataDB);
    TBMSchedulesInit(sourceDataDB);
    const TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(sourceDataDB);
    const SNCFScheduledRoutesModel = SNCFScheduledRoutesModelInit(sourceDataDB);
    const NonScheduledRoutesModel = NonScheduledRoutesModelInit(sourceDataDB);

    // Virtual IDs (stops routes) management

    const stopIdsMappingF = new Map<`${Providers}-${ProviderStopId}`, number>();
    const stopIdsMappingB = new Map<number, [ProviderStopId, Providers]>();
    const TBMStopsCount = (await TBMStopsModel.estimatedDocumentCount()) * 1.5;
    const SNCFStopsCount = (await SNCFStopsModel.estimatedDocumentCount()) * 1.5;
    const stopIdsRanges = {
      [Providers.TBM]: [0, TBMStopsCount, -1],
      [Providers.SNCF]: [TBMStopsCount + 1, TBMStopsCount + 1 + SNCFStopsCount, -1],
    } satisfies Record<string, [number, number, number]>;
    const mapStopId = makeMapId(stopIdsRanges, stopIdsMappingF, stopIdsMappingB)[0];

    const routeIdsMappingF = new Map<`${Providers}-${ProviderRouteId}`, number>();
    const routeIdsMappingB = new Map<number, [ProviderRouteId, Providers]>();
    // Memoizing allows us to only remember backward mapping, forward mapping is stored inside memoize
    const TBMSRCount = (await TBMScheduledRoutesModel.estimatedDocumentCount()) * 1.5;
    const SNCFSRCount = (await SNCFScheduledRoutesModel.estimatedDocumentCount()) * 1.5;
    const routeIdsRanges = {
      [Providers.TBM]: [0, TBMSRCount, -1],
      [Providers.SNCF]: [TBMSRCount + 1, TBMSRCount + 1 + SNCFSRCount, -1],
    } satisfies Record<string, [number, number, number]>;
    const mapRouteId = makeMapId(routeIdsRanges, routeIdsMappingF, routeIdsMappingB)[0];

    // Non scheduled routes

    // Query must associate (s, from) AND (from, s) forall s in stops !
    const dbNonScheduledRoutes = (
      (await NonScheduledRoutesModel.find<DocumentType<dbNonScheduledRoute>>(
        { distance: { $lte: NON_SCHEDULED_ROUTES_MAX_DIST } },
        { ...dbNonScheduledRoutesProjection, _id: 0 },
      )
        .lean()
        .exec()) as dbNonScheduledRoute[]
    ).reduce<
      Map<number, ConstructorParameters<typeof RAPTORDataClass<unknown, number, number>>[1][number][2]>
    >((acc, { from, to, distance }) => {
      const mappedFrom = mapStopId(parseInt(from.substring(3).split("-")[0]), parseInt(from.split("-")[1]));
      const mappedTo = mapStopId(parseInt(to.substring(3).split("-")[0]), parseInt(to.split("-")[1]));

      for (const [from, to] of [
        [mappedFrom, mappedTo],
        [mappedTo, mappedFrom],
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
        .populate("trips.schedules", { ...schedulesProjection, _id: 0, __t: 0 })
        .lean()
        .exec()) as TBMScheduledRoute[]
    ).map(({ _id, stops, trips }) => ({
      _id,
      stops: stops.map((stop) => mapStopId(Providers.TBM, stop)),
      trips,
    }));

    const TBMStops = dbTBMScheduledRoutes.reduce<
      Map<number, [number[], Exclude<ReturnType<(typeof dbNonScheduledRoutes)["get"]>, undefined>]>
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

    // SNCF stops & routes

    const dbSNCFScheduledRoutes = (
      (await SNCFScheduledRoutesModel.find<DocumentType<SNCFScheduledRoute>>(
        {},
        dbSNCFScheduledRoutesProjection,
      )
        .populate("trips.schedules", { ...schedulesProjection, _id: 0 })
        .lean()
        .exec()) as SNCFScheduledRoute[]
    ).map(({ _id, stops, trips }) => ({
      _id,
      stops: stops.map((stop) => mapStopId(Providers.SNCF, stop)),
      trips,
    }));

    const SNCFStops = dbSNCFScheduledRoutes.reduce<
      Map<number, [number[], Exclude<ReturnType<(typeof dbNonScheduledRoutes)["get"]>, undefined>]>
    >(
      (acc, { _id: routeId, stops }) => {
        for (const stopId of stops) {
          let stop = acc.get(stopId);
          if (!stop) {
            stop = [[], dbNonScheduledRoutes.get(stopId) ?? []];
            acc.set(stopId, stop);
          }

          stop[0].push(mapRouteId(Providers.SNCF, routeId));
        }

        return acc;
      },
      new Map(
        (
          (await SNCFStopsModel.find<DocumentType<SNCFStop>>(
            { coords: { $not: { $elemMatch: { $eq: Infinity } } } },
            dbSNCFStopProjection,
          )
            .lean()
            .exec()) as SNCFStop[]
        ).map(({ _id }) => {
          const mappedId = mapStopId(Providers.SNCF, _id);

          return [mappedId, [[], dbNonScheduledRoutes.get(mappedId) ?? []]];
        }),
      ),
    );

    // Finally make RAPTOR data

    const RAPTORData = SharedRAPTORData.makeFromRawData(
      sharedTimeIntOrderLow,
      [
        ...TBMStops.entries().map(
          ([id, [connectedRoutes, nonScheduledRoutes]]) =>
            [id, connectedRoutes, nonScheduledRoutes] satisfies [unknown, unknown, unknown],
        ),
        ...SNCFStops.entries().map(
          ([id, [connectedRoutes, nonScheduledRoutes]]) =>
            [id, connectedRoutes, nonScheduledRoutes] satisfies [unknown, unknown, unknown],
        ),
      ],
      [
        ...dbTBMScheduledRoutes.map(
          ({ _id, stops, trips }) =>
            [
              // Don't forget to finally map route ID!
              mapRouteId(Providers.TBM, _id),
              stops,
              trips.map(({ schedules }) =>
                // Make schedules intervals
                schedules.map(
                  (schedule) =>
                    [
                      schedule.arr_int_hor.map((time) => time.getTime()) as [number, number],
                      schedule.dep_int_hor.map((time) => time.getTime()) as [number, number],
                    ] satisfies [unknown, unknown],
                ),
              ),
            ] satisfies [unknown, unknown, unknown],
        ),
        ...dbSNCFScheduledRoutes.map(
          ({ _id, stops, trips }) =>
            [
              // Don't forget to finally map route ID!
              mapRouteId(Providers.SNCF, _id),
              stops,
              trips.map(({ schedules }) =>
                // Make schedules intervals
                schedules.map(
                  (schedule) =>
                    [
                      schedule.arr_int_hor.map((time) => time.getTime()) as [number, number],
                      schedule.dep_int_hor.map((time) => time.getTime()) as [number, number],
                    ] satisfies [unknown, unknown],
                ),
              ),
            ] satisfies [unknown, unknown, unknown],
        ),
      ],
    );

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
