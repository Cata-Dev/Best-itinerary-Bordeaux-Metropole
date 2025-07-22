import { mapAsync } from "@bibm/common/async";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import { dbTBM_Lines_routes } from "@bibm/data/models/TBM/TBM_lines_routes.model";
import {
  RtScheduleState,
  RtScheduleType,
  dbTBM_Schedules_rt,
} from "@bibm/data/models/TBM/TBM_schedules.model";
import { dbTBM_Trips } from "@bibm/data/models/TBM/TBM_trips.model";
import TBM_Scheduled_routes, { dbTBM_ScheduledRoutes } from "@bibm/data/models/TBM/TBMScheduledRoutes.model";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint, makeConcurrentHook } from "../../endpoint";

export default async (
  app: Application,
  TBM_lines_routesEndpointInstantiated: Endpoint<TBMEndpoints.Lines_routes>,
  TBM_schedulesRtEndpointInstantiated: Endpoint<TBMEndpoints.Schedules_rt>,
  TBM_tripsEndpointInstantiated: Endpoint<TBMEndpoints.Trips>,
) => {
  const ScheduledRoute = TBM_Scheduled_routes(app.get("sourceDBConn"));

  const routeProjection = {
    _id: 1,
  } satisfies Partial<Record<keyof dbTBM_Lines_routes, 1>>;

  const tripProjection = {
    _id: 1,
  } satisfies Partial<Record<keyof dbTBM_Trips, 1>>;

  const scheduleRtProjection = {
    _id: 1,
    hor_theo: 1,
    hor_estime: 1,
    rs_sv_arret_p: 1,
  } satisfies Partial<Record<keyof dbTBM_Schedules_rt, 1>>;

  return [
    await new Endpoint(
      TBMEndpoints.ScheduledRoutes,
      // Manual fetches only
      Infinity,
      async () => {
        const fillSchedule =
          (await TBM_schedulesRtEndpointInstantiated.model.findOne({ _id: Infinity })) ??
          (await TBM_schedulesRtEndpointInstantiated.model.create({
            _id: Infinity,
            hor_theo: new Date(0),
            hor_app: new Date(0),
            hor_estime: new Date(0),
            realtime: true,
            etat: RtScheduleState.Realise,
            type: RtScheduleType.Regulier,
            rs_sv_arret_p: Infinity,
            rs_sv_cours_a: Infinity,
          } as dbTBM_Schedules_rt));

        let tripsCount = 0;
        let schedulesCount = 0;

        const scheduledRoutes: dbTBM_ScheduledRoutes[] = [];
        for await (const route of TBM_lines_routesEndpointInstantiated.model
          .find({}, routeProjection)
          .lean<Pick<dbTBM_Lines_routes, keyof typeof routeProjection>[]>()
          .cursor()) {
          const relevantTrips =
            // Find schedules associated to each trip
            await TBM_tripsEndpointInstantiated.model
              .find({ rs_sv_chem_l: route._id }, tripProjection)
              .lean<Pick<dbTBM_Trips, keyof typeof tripProjection>[]>();
          tripsCount += relevantTrips.length;

          let largestTrip: Pick<dbTBM_Schedules_rt, keyof typeof scheduleRtProjection>[] = [];

          const formattedTrips = (
            await mapAsync(relevantTrips, async (relevantTrip) => {
              const schedules = await TBM_schedulesRtEndpointInstantiated.model
                .find(
                  { rs_sv_cours_a: relevantTrip._id, etat: { $ne: RtScheduleState.Annule } },
                  scheduleRtProjection,
                )
                .sort({ hor_theo: 1 })
                .lean<Pick<dbTBM_Schedules_rt, keyof typeof scheduleRtProjection>[]>();

              // Accumulate max trip in terms of number of stops
              if (schedules.length > largestTrip.length) largestTrip = schedules;
              // Stats
              schedulesCount += schedules.length;

              return {
                tripId: relevantTrip._id,
                schedules,
              };
            })
          )
            // Keep only trips with schedules (non-empty)
            .filter((t) => t.schedules.length)
            // Begin formatting & adjust data
            .map(({ tripId, schedules }) => ({
              tripId,
              schedules: largestTrip.reduce<{ schedules: typeof schedules; i: number }>(
                (acc, { rs_sv_arret_p: stopId }, i) => {
                  if (acc.i < schedules.length && schedules[acc.i].rs_sv_arret_p === stopId) {
                    // The current schedule stop matches with the stop at the current index, use it & consume it
                    acc.schedules[i] = schedules[acc.i];
                    acc.i++;
                  } else acc.schedules[i] = fillSchedule;

                  return acc;
                },
                {
                  schedules: Array.from({ length: largestTrip.length }),
                  i: 0,
                },
              ).schedules,
            }))
            // Sort by last schedule
            .sort(
              (a, b) =>
                (a.schedules[a.schedules.length - 1].hor_theo?.valueOf() ?? 0) -
                (b.schedules[b.schedules.length - 1].hor_theo?.valueOf() ?? 0),
            )
            // End formatting, extract/keep only schedule ID
            .map(({ tripId, schedules }) => ({
              tripId,
              schedules: schedules.map(({ _id }) => _id),
            }));

          scheduledRoutes.push({
            _id: route._id,
            trips: formattedTrips,
            stops: largestTrip.map((s) => s.rs_sv_arret_p),
          });
        }

        if (app.get("debug")) logger.debug(`Retrieved ${scheduledRoutes.length} lines routes`);

        if (app.get("debug"))
          logger.debug(
            `Retrieved ${tripsCount} trips and ${schedulesCount} realtime schedules during scheduled routes computation`,
          );

        const [bulked, { deletedCount }] = await bulkUpsertAndPurge(ScheduledRoute, scheduledRoutes, ["_id"]);
        if (app.get("debug"))
          logger.debug(
            `Scheduled routes: updated ${bulked.upsertedCount}, inserted ${bulked.insertedCount} and deleted ${deletedCount}`,
          );

        return true;
      },
      ScheduledRoute,
    )
      .registerHook(() => () => app.get("computeInstance").refreshData(["compute"]))
      .init(),
  ] as const;
};

export const makeSRHook = makeConcurrentHook<
  TBMEndpoints.Lines_routes | TBMEndpoints.Schedules_rt | TBMEndpoints.Stops | TBMEndpoints.Trips
>(
  (app) =>
    void app.externalAPIs.TBM.endpoints[TBMEndpoints.ScheduledRoutes]
      .fetch(true, app.get("debug"))
      .catch((err) => logger.warn(err)),
);
