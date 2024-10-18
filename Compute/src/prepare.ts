import { initDB } from "./utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import { FilterQuery } from "mongoose";
import { DocumentType } from "@typegoose/typegoose";
import { SharedRAPTORData } from "raptor/lib/SharedStructures";
import stopsModelInit, { dbTBM_Stops } from "data/lib/models/TBM/TBM_stops.model";
import TBMScheduledRoutesModelInit, {
  dbTBM_ScheduledRoutes,
} from "data/lib/models/TBM/TBMScheduledRoutes.model";
import NonScheduledRoutesModelInit, { dbFootPaths } from "data/lib/models/TBM/NonScheduledRoutes.model";
import { populateRef, UnpackRefType } from "./utils";
import { mapAsync } from "./utils/asyncs";
import { Application } from "./base";

async function makeData(
  app: Application,
): Promise<Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]> {
  app.logger.info("Preparing data....");

  const sourceDataDB = await initDB(app, app.config.sourceDB);
  const stopsModel = stopsModelInit(sourceDataDB);
  const TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(sourceDataDB);
  const NonScheduledRoutesModel = NonScheduledRoutesModelInit(sourceDataDB);

  /** DB Types */

  type dbTBM_Schedules_rt = populateRef<dbScheduledRoute["trips"][number]["schedules"]>[number];
  // Schedules
  const dbSchedulesProjection = { hor_app: 1, hor_estime: 1 } satisfies Partial<
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
  const dbStopProjection = { _id: 1, coords: 1 };
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

  const dbScheduledRoutes = (await TBMScheduledRoutesModel.find<DocumentType<ScheduledRoute>>(
    {},
    dbScheduledRoutesProjection,
  )
    // Add ability to use binary search
    .sort({ _id: 1 })
    .populate("trips.schedules", { ...dbSchedulesProjection, _id: 0, __t: 0 })
    .lean()
    .exec()) as ScheduledRoute[];

  const dbStops = (await stopsModel
    .find<DocumentType<Stop>>({ coords: { $not: { $elemMatch: { $eq: Infinity } } } }, dbStopProjection)
    .lean()
    .exec()) as Stop[];

  //Query must associate (s, from) AND (from, s) forall s in stops !
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
    await mapAsync(dbStops, async ({ _id, coords }) => ({
      id: _id,
      lat: coords[0],
      long: coords[1],
      connectedRoutes: dbScheduledRoutes
        .filter((ScheduledRoute) => ScheduledRoute.stops.find((stopId) => stopId === _id))
        .map(({ _id }) => _id),
      transfers: (await dbNonScheduledRoutes(_id, { distance: { $lte: 1_000 } })).map(({ to, distance }) => ({
        to,
        length: distance,
      })),
    })),
    dbScheduledRoutes.map(
      ({ _id, stops, trips }) =>
        [
          _id,
          stops,
          trips.map(({ tripId, schedules }) => ({
            id: tripId,
            times: schedules.map((schedule) =>
              "hor_estime" in schedule
                ? ([
                    schedule.hor_estime.getTime() || SharedRAPTORData.MAX_SAFE_TIMESTAMP,
                    schedule.hor_estime.getTime() || SharedRAPTORData.MAX_SAFE_TIMESTAMP,
                  ] satisfies [unknown, unknown])
                : ([Infinity, Infinity] satisfies [unknown, unknown]),
            ),
          })),
        ] satisfies [unknown, unknown, unknown],
    ),
  );

  app.logger.info("Data prepared.");

  return RAPTORData.internalData;
}

export { makeData };
