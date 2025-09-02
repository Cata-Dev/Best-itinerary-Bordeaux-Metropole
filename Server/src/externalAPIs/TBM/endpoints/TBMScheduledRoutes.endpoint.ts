import { mapAsync, reduceAsync } from "@bibm/common/async";
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
        const fillScheduleId = (
          (await TBM_schedulesRtEndpointInstantiated.model.findOne({ _id: Infinity })) ??
          (await TBM_schedulesRtEndpointInstantiated.model.create({
            _id: Infinity,
            hor_theo: new Date(0),
            hor_app: new Date(0),
            hor_estime: new Date(0),
            arr_int_hor: [new Date(0), new Date(0)],
            dep_int_hor: [new Date(0), new Date(0)],
            realtime: true,
            etat: RtScheduleState.Realise,
            type: RtScheduleType.Regulier,
            rs_sv_arret_p: Infinity,
            rs_sv_cours_a: Infinity,
          } satisfies dbTBM_Schedules_rt))
        )._id;

        let tripsCount = 0;
        let schedulesCount = 0;

        // https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#-sort----limit-coalescence
        let maxRouteId =
          (
            await TBM_lines_routesEndpointInstantiated.model.find({}, { _id: 1 }).sort({ _id: -1 }).limit(1)
          )[0]?._id ?? 0;
        const newSubRoutes: dbTBM_Lines_routes[] = [];
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

          const [trips, newSubScheduledRoutes] = await reduceAsync(
            (
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
              // Sort by last schedule
              .sort(
                (a, b) => a.schedules.at(-1)!.hor_theo.getTime() - b.schedules.at(-1)!.hor_theo.getTime(),
              ),
            // Adjust & format data
            async (acc, { tripId, schedules }) => {
              let trips = acc[0];

              const firstCommonStop = largestTrip.findIndex(
                ({ rs_sv_arret_p: stopId }) => stopId === schedules[0].rs_sv_arret_p,
              );
              const schedulesPrefixCntDiff = firstCommonStop < 0 ? 0 : firstCommonStop;
              const filledSchedules = Array.from<dbTBM_ScheduledRoutes["trips"][number]["schedules"][number]>(
                {
                  length: schedulesPrefixCntDiff,
                },
              )
                .fill(fillScheduleId)
                .concat(schedules.map(({ _id }) => _id));

              if (filledSchedules.length !== largestTrip.length) {
                // Need to create a (new) sub route, it may have holes of stops
                // Its stops, with the prefix added
                const stops = largestTrip
                  .slice(0, schedulesPrefixCntDiff)
                  .map(({ rs_sv_arret_p }) => rs_sv_arret_p)
                  // Then concat actual stops
                  .concat(schedules.map((schedule) => schedule.rs_sv_arret_p));
                // A hash of it: its stops, chained
                const hashedRoute = stops.reduce(
                  (acc, stopId) => `${acc}-${(stopId as number).toString()}`,
                  "",
                );

                trips = (acc[1][hashedRoute] ??= {
                  newRoute:
                    // This new route is essentially the same as the previous one, except its new id and its ends
                    new TBM_lines_routesEndpointInstantiated.model(
                      await (async () => {
                        const fullRoute = (await TBM_lines_routesEndpointInstantiated.model.findById(
                          route._id,
                          null,
                          {
                            lean: true,
                            timestamps: false,
                          },
                        ))!;

                        return {
                          ...fullRoute,
                          _id: ++maxRouteId,
                          rg_sv_arret_p_nd: stops[0],
                          rg_sv_arret_p_na: stops.at(-1)!,
                          libelle: fullRoute.libelle + " (bis)",
                        } satisfies dbTBM_Lines_routes;
                      })(),
                    ),
                  stops,
                  trips: [],
                }).trips;
              }

              trips.push({
                tripId,
                schedules: filledSchedules,
              });

              return acc;
            },
            [[], {}] as [
              trips: dbTBM_ScheduledRoutes["trips"],
              subScheduledRoutes: Record<
                string,
                {
                  newRoute: dbTBM_Lines_routes;
                  stops: dbTBM_ScheduledRoutes["stops"];
                  trips: dbTBM_ScheduledRoutes["trips"];
                }
              >,
            ],
          );

          newSubRoutes.push(...Object.values(newSubScheduledRoutes).map(({ newRoute }) => newRoute));
          scheduledRoutes.push(
            {
              _id: route._id,
              trips,
              stops: largestTrip.map((s) => s.rs_sv_arret_p),
            },
            ...Object.values(newSubScheduledRoutes).map(({ newRoute, trips, stops }) => ({
              _id: newRoute._id,
              trips,
              stops,
            })),
          );
        }

        if (app.get("debug")) logger.debug(`Retrieved ${scheduledRoutes.length} lines routes`);

        if (app.get("debug"))
          logger.debug(
            `Retrieved ${tripsCount} trips and ${schedulesCount} realtime schedules during scheduled routes computation`,
          );

        const inserted = await TBM_lines_routesEndpointInstantiated.model.insertMany(newSubRoutes, {
          // Fasten insert
          lean: true,
          rawResult: true,
        });
        if (app.get("debug"))
          logger.debug(`Scheduled routes: inserted ${inserted.length} new sub line routes`);

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

export const makeTBMSRHook = makeConcurrentHook<
  TBMEndpoints.Lines_routes | TBMEndpoints.Schedules_rt | TBMEndpoints.Stops | TBMEndpoints.Trips
>(
  (app) =>
    void app.externalAPIs.TBM.endpoints[TBMEndpoints.ScheduledRoutes]
      .fetch(true, app.get("debug"))
      .catch((err) => logger.warn(err)),
);
