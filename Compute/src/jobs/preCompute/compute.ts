// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { mapAsync } from "@bibm/common/async";
import { Logger } from "@bibm/common/logger";
import { binarySearch } from "@bibm/common/opti";
import { UnpackRefType } from "@bibm/common/types";
import NonScheduledRoutesModelInit, { dbFootPaths } from "@bibm/data/models/TBM/NonScheduledRoutes.model";
import TBMSchedulesInit, { dbTBM_Schedules_rt } from "@bibm/data/models/TBM/TBM_schedules.model";
import stopsModelInit, { dbTBM_Stops } from "@bibm/data/models/TBM/TBM_stops.model";
import TBMScheduledRoutesModelInit, {
  dbTBM_ScheduledRoutes,
} from "@bibm/data/models/TBM/TBMScheduledRoutes.model";
import { DocumentType } from "@typegoose/typegoose";
import { FilterQuery } from "mongoose";
import { sep } from "node:path";
import { parentPort } from "node:worker_threads";
import { SharedRAPTORData, sharedTimeIntOrderLow, TimeScal } from "raptor";
import { preComputeLogger } from ".";
import { app } from "../../base";
import { initDB } from "../../utils/mongoose";

/** DB Types */

// Schedules
const dbSchedulesProjection = { hor_theo: 1, hor_estime: 1, hor_app: 1 } satisfies Partial<
  Record<keyof dbTBM_Schedules_rt, 1>
>;
type dbScheduleRt = Pick<dbTBM_Schedules_rt, keyof typeof dbSchedulesProjection>;

// Scheduled Routes
const dbScheduledRoutesProjection = { _id: 1, stops: 1, trips: 1 } satisfies Partial<
  Record<keyof dbTBM_ScheduledRoutes, 1>
>;
type dbScheduledRoute = Pick<dbTBM_ScheduledRoutes, keyof typeof dbScheduledRoutesProjection>;
interface ScheduledRoutesOverwritten /* extends dbTBM_ScheduledRoutes */ {
  stops: UnpackRefType<dbScheduledRoute["stops"]>;
  trips: {
    tripId: dbScheduledRoute["trips"][number]["tripId"];
    // Not a Document because of lean
    schedules: dbScheduleRt[];
  }[];
}
type ScheduledRoute = Omit<dbScheduledRoute, keyof ScheduledRoutesOverwritten> & ScheduledRoutesOverwritten;

// Stops
const dbStopProjection = { _id: 1 } satisfies Partial<Record<keyof dbTBM_Stops, 1>>;
type Stop = Pick<dbTBM_Stops, keyof typeof dbStopProjection>;

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

if (parentPort) {
  const logger = new Logger(preComputeLogger, `[${(__filename.split(sep).pop() ?? "").split(".")[0]}]`);

  (async () => {
    logger.log("Making pre-computed compute job data...");

    // DB-related stuff
    const sourceDataDB = await initDB({ ...app, logger }, app.config.sourceDB);
    const stopsModel = stopsModelInit(sourceDataDB);
    TBMSchedulesInit(sourceDataDB);
    const TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(sourceDataDB);
    const NonScheduledRoutesModel = NonScheduledRoutesModelInit(sourceDataDB);

    const dbScheduledRoutes = (await TBMScheduledRoutesModel.find<DocumentType<ScheduledRoute>>(
      {},
      dbScheduledRoutesProjection,
    )
      // Add ability to use binary search
      .sort({ _id: 1 })
      .populate("trips.schedules", { ...dbSchedulesProjection, _id: 0, __t: 0 })
      .lean()
      .exec()) as ScheduledRoute[];

    const stops = dbScheduledRoutes.reduce<
      { id: ScheduledRoute["stops"][number]; connectedRoutes: ScheduledRoute["_id"][] }[]
    >(
      (acc, { _id, stops }) => {
        for (const stop of stops) {
          let pos = binarySearch(acc, stop, (a, b) => a - b.id);
          if (pos < 0) {
            pos = -pos - 1;
            acc.splice(pos, 0, { id: stop, connectedRoutes: [] });
          }
          acc[pos].connectedRoutes.push(_id);
        }

        return acc;
      },
      (
        (await stopsModel
          .find<DocumentType<Stop>>({ coords: { $not: { $elemMatch: { $eq: Infinity } } } }, dbStopProjection)
          .sort({ _id: 1 })
          .lean()
          .exec()) as Stop[]
      ).map(({ _id: id }) => ({ id, connectedRoutes: [] })),
    );

    // Query must associate (s, from) AND (from, s) forall s in stops !
    const dbNonScheduledRoutes = async (
      stopId: NonScheduledRoutesOverwritten["from"],
      additionalQuery: FilterQuery<dbNonScheduledRoute> = {},
    ) =>
      (
        (await NonScheduledRoutesModel.find<DocumentType<NonScheduledRoute>>(
          { $and: [{ $or: [{ from: stopId }, { to: stopId }] }, additionalQuery] },
          { ...dbNonScheduledRoutesProjection, _id: 0 },
        )
          .lean()
          .exec()) as NonScheduledRoute[]
      ).map(({ from, to, distance }) => ({ distance, to: to === stopId ? from : to }));

    const RAPTORData = SharedRAPTORData.makeFromRawData(
      sharedTimeIntOrderLow,
      await mapAsync(stops, async ({ id, connectedRoutes }) => [
        id,
        connectedRoutes,
        (
          await dbNonScheduledRoutes(id, {
            distance: {
              $lte:
                // TODO: do not limit?
                3_000,
            },
          })
        ).map(({ to, distance }) => ({
          to,
          length: distance,
        })),
      ]),
      dbScheduledRoutes.map(
        ({ _id, stops, trips }) =>
          [
            _id,
            stops,
            trips.map(({ tripId, schedules }) => ({
              id: tripId,
              times: schedules.map((schedule) => {
                let theo = schedule.hor_theo.getTime() || TimeScal.MAX_SAFE;
                let estime = schedule.hor_estime.getTime() || schedule.hor_app.getTime() || TimeScal.MAX_SAFE;

                // Prevent upper bound to be MAX_SAFE
                if (theo < TimeScal.MAX_SAFE && estime === TimeScal.MAX_SAFE) estime = theo;
                if (estime < TimeScal.MAX_SAFE && theo === TimeScal.MAX_SAFE) theo = estime;

                const int = theo < estime ? [theo, estime] : [estime, theo];
                return [[int[0], int[1]] as const, [int[0], int[1]] as const] satisfies [unknown, unknown];
              }),
            })),
          ] satisfies [unknown, unknown, unknown],
      ),
    );

    await sourceDataDB.close();

    logger.info("Pre-computed compute job data made.");

    parentPort.postMessage(RAPTORData.internalData satisfies ReturnType<makeComputeData>);
  })().catch((err) => logger.warn("During compute job data pre-computation", err));
}

export type makeComputeData = () => Parameters<typeof SharedRAPTORData.makeFromInternalData>[1];
