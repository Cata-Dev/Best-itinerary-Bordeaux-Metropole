import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import stopsModelInit, { dbTBM_Stops } from "data/lib/models/TBM/TBM_stops.model";
import type { dbTBM_ScheduledRoutes } from "data/lib/models/TBM/TBMScheduledRoutes.model";
import TBMScheduledRoutesModelInit from "data/lib/models/TBM/TBMScheduledRoutes.model";
import type { dbFootPaths } from "data/lib/models/TBM/NonScheduledRoutes.model";
import NonScheduledRoutesModelInit from "data/lib/models/TBM/NonScheduledRoutes.model";
import ResultModelInit, {
  JourneyLabelType,
  LabelBase,
  dbComputeResult,
  routeId,
  stopId,
} from "data/lib/models/Compute/result.model";
import type { FilterQuery } from "mongoose";
import type { DocumentType } from "@typegoose/typegoose";
import { withDefaults, type populateRef, type unpackRefType } from "../utils";
import type { Journey, RAPTORRunSettings } from "raptor";
import RAPTOR from "raptor";
import type { Stop as RAPTORStop } from "raptor/lib/Structures";
import { defaultRAPTORRunSettings } from "data/lib/values/RAPTOR";
import { MAX_SAFE_TIMESTAMP } from "raptor/lib/Structures";
import { mapAsync } from "../utils/asyncs";

declare module "." {
  interface Jobs {
    compute: (ps: stopId, pt: stopId, date: Date, settings: Partial<RAPTORRunSettings>) => number;
  }
}

import type { Application } from "../base";
import type { jobFn } from ".";

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
  stops: unpackRefType<dbScheduledRoute["stops"]>;
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
  from: unpackRefType<dbNonScheduledRoute["from"]>;
  to: unpackRefType<dbNonScheduledRoute["to"]>;
}
type NonScheduledRoute = Omit<dbNonScheduledRoute, keyof NonScheduledRoutesOverwritten> &
  NonScheduledRoutesOverwritten;

async function queryData(
  stopsModel: ReturnType<typeof stopsModelInit>,
  TBMScheduledRoutesModel: ReturnType<typeof TBMScheduledRoutesModelInit>,
  NonScheduledRoutesModel: ReturnType<typeof NonScheduledRoutesModelInit>,
) {
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

  return { dbScheduledRoutes, dbStops, dbNonScheduledRoutes };
}

async function createRAPTOR({
  dbScheduledRoutes,
  dbStops,
  dbNonScheduledRoutes,
}: Pick<Awaited<ReturnType<typeof queryData>>, "dbNonScheduledRoutes" | "dbScheduledRoutes" | "dbStops">) {
  const RAPTORInstance = new RAPTOR<stopId, routeId>(
    await mapAsync<(typeof dbStops)[number], RAPTORStop<stopId, routeId>>(
      dbStops,
      async ({ _id, coords }) => ({
        id: _id,
        lat: coords[0],
        long: coords[1],
        connectedRoutes: dbScheduledRoutes
          .filter((ScheduledRoute) => ScheduledRoute.stops.find((stopId) => stopId === _id))
          .map(({ _id }) => _id),
        transfers: (await dbNonScheduledRoutes(_id, { distance: { $lte: 1_000 } })).map(
          ({ to, distance }) => ({
            to,
            length: distance,
          }),
        ),
      }),
    ),
    dbScheduledRoutes.map(({ _id, stops, trips }) => [
      _id,
      stops,
      trips.map(({ tripId, schedules }) => ({
        id: tripId,
        times: schedules.map((schedule) =>
          // Take scheduled time by default
          "hor_app" in schedule
            ? [
                schedule.hor_app.getTime() || MAX_SAFE_TIMESTAMP,
                schedule.hor_app.getTime() || MAX_SAFE_TIMESTAMP,
              ]
            : [Infinity, Infinity],
        ),
      })),
    ]),
  );

  return { RAPTORInstance };
}

type DBJourney = LabelBase[];
function journeyDBFormatter(j: Journey<stopId, routeId>): DBJourney {
  return j.map<LabelBase>((label) => ({
    ...label,
    type: "transfer" in label ? JourneyLabelType.Foot : JourneyLabelType.Vehicle,
  }));
}

export default (async function (app: Application) {
  // Init DB & models
  const sourceDataDB = await initDB(app, app.config.sourceDataDB);
  const stopsModel = stopsModelInit(sourceDataDB);
  // TBMSchedulesModelInit(sourceDataDB);
  const TBMScheduledRoutesModel = TBMScheduledRoutesModelInit(sourceDataDB);
  const NonScheduledRoutesModel = NonScheduledRoutesModelInit(sourceDataDB);

  const dataDB = await initDB(app, app.config.mainDB);
  const resultModel = ResultModelInit(dataDB);

  const { RAPTORInstance } = await createRAPTOR(
    await queryData(stopsModel, TBMScheduledRoutesModel, NonScheduledRoutesModel),
  );

  app.agenda.define(
    "compute",
    async ({
      attrs: {
        data: [ps, pt, departureDate, reqSettings],
      },
    }) => {
      const settings = withDefaults(reqSettings, defaultRAPTORRunSettings);

      RAPTORInstance.run(ps, pt, departureDate.getTime(), settings);
      const bestJourneys = RAPTORInstance.getBestJourneys(pt).filter(
        (j): j is Journey<stopId, routeId> => !!j,
      );

      if (!bestJourneys.length) throw "No journey found";

      // Keep only fastest journey & shortest journey
      const fastestJourney = bestJourneys.at(-1)!;
      const shortestJourney = bestJourneys.reduce(
        (acc, v) => (acc.length < v.length ? acc : v),
        bestJourneys[0],
      );

      const { _id } = await resultModel.create({
        from: ps,
        to: pt,
        journeys: [fastestJourney, shortestJourney].map((j) => journeyDBFormatter(j)),
        settings,
      } satisfies dbComputeResult);

      return _id;
    },
    { concurrency: 1, priority: "high" },
  );
} satisfies jobFn);
