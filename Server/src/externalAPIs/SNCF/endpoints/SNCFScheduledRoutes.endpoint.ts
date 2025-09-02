import { mapAsync, reduceAsync } from "@bibm/common/async";
import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import { dbSNCF_Schedules, SNCF_ScheduleFreshness } from "@bibm/data/models/SNCF/SNCF_schedules.model";
import SNCF_Scheduled_routes, {
  dbSNCF_ScheduledRoutes,
} from "@bibm/data/models/SNCF/SNCFScheduledRoutes.model";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint, makeConcurrentHook } from "../../endpoint";

export default async (
  app: Application,
  SNCF_SchedulesEndpointInstantiated: Endpoint<SNCFEndpoints.Schedules>,
) => {
  const ScheduledRoute = SNCF_Scheduled_routes(app.get("sourceDBConn"));

  const scheduleProjection = {
    _id: 1,
    arrival: 1,
    departure: 1,
    stop: 1,
  } satisfies Partial<Record<keyof dbSNCF_Schedules, 1>>;

  return [
    await new Endpoint(
      SNCFEndpoints.ScheduledRoutes,
      // Manual fetches only
      Infinity,
      async () => {
        const fillScheduleId = (
          (await SNCF_SchedulesEndpointInstantiated.model.findOne({ _id: `${Infinity}:${Infinity}` })) ??
          (await SNCF_SchedulesEndpointInstantiated.model.create({
            _id: `${Infinity}:${Infinity}`,
            arrival: new Date(0),
            baseArrival: new Date(0),
            departure: new Date(0),
            baseDeparture: new Date(0),
            arr_int_hor: [new Date(0), new Date(0)],
            dep_int_hor: [new Date(0), new Date(0)],
            freshness: SNCF_ScheduleFreshness.Base,
            trip: Infinity,
            stop: Infinity,
            route: `${Infinity}`,
          } satisfies dbSNCF_Schedules))
        )._id;

        let tripsCount = 0;
        let schedulesCount = 0;

        let maxRouteId = 0;
        const scheduledRoutes: dbSNCF_ScheduledRoutes[] = [];
        for (const route of await SNCF_SchedulesEndpointInstantiated.model.distinct("route", {
          _id: { $ne: fillScheduleId },
        })) {
          const relevantTrips =
            // Find schedules associated to each trip
            await SNCF_SchedulesEndpointInstantiated.model.distinct("trip", { route });
          tripsCount += relevantTrips.length;

          let largestTrip: Pick<dbSNCF_Schedules, keyof typeof scheduleProjection>[] = [];

          const [trips, newSubScheduledRoutes] = await reduceAsync(
            (
              await mapAsync(relevantTrips, async (trip) => {
                const schedules = await SNCF_SchedulesEndpointInstantiated.model
                  .find(
                    {
                      // Should not need to precise route as it's implied by the trip
                      trip,
                    },
                    scheduleProjection,
                  )
                  .sort({ hor_theo: 1 })
                  .lean<Pick<dbSNCF_Schedules, keyof typeof scheduleProjection>[]>();

                // Accumulate max trip in terms of number of stops
                if (schedules.length > largestTrip.length) largestTrip = schedules;
                // Stats
                schedulesCount += schedules.length;

                return {
                  tripId: trip,
                  schedules,
                };
              })
            )
              // Keep only trips with schedules (non-empty)
              .filter((t) => t.schedules.length)
              // Sort by last schedule
              .sort((a, b) => a.schedules.at(-1)!.arrival.getTime() - b.schedules.at(-1)!.arrival.getTime()),
            // Adjust & format data
            // Let this async as inserting new routes like TBM might be needed soon
            // eslint-disable-next-line @typescript-eslint/require-await
            async (acc, { tripId, schedules }) => {
              let trips = acc[0];

              const firstCommonStop = largestTrip.findIndex(
                ({ stop: stopId }) => stopId === schedules[0].stop,
              );
              const schedulesPrefixCntDiff = firstCommonStop < 0 ? 0 : firstCommonStop;
              const filledSchedules = Array.from<
                dbSNCF_ScheduledRoutes["trips"][number]["schedules"][number]
              >({
                length: schedulesPrefixCntDiff,
              })
                .fill(fillScheduleId)
                .concat(schedules.map(({ _id }) => _id));

              if (filledSchedules.length !== largestTrip.length) {
                // Need to create a (new) sub route, it may have holes of stops
                // Its stops, with the prefix added
                const stops = largestTrip
                  .slice(0, schedulesPrefixCntDiff)
                  .map(({ stop }) => stop)
                  // Then concat actual stops
                  .concat(schedules.map((schedule) => schedule.stop));
                // A hash of it: its stops, chained
                const hashedRoute = stops.reduce(
                  (acc, stopId) => `${acc}-${(stopId as number).toString()}`,
                  "",
                );

                trips = (acc[1][hashedRoute] ??= {
                  id: `${++maxRouteId}`,
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
              trips: dbSNCF_ScheduledRoutes["trips"],
              subScheduledRoutes: Record<
                string,
                {
                  id: dbSNCF_ScheduledRoutes["_id"];
                  stops: dbSNCF_ScheduledRoutes["stops"];
                  trips: dbSNCF_ScheduledRoutes["trips"];
                }
              >,
            ],
          );

          scheduledRoutes.push(
            {
              _id: route,
              trips,
              stops: largestTrip.map((s) => s.stop),
            },
            ...Object.values(newSubScheduledRoutes).map(({ id, trips, stops }) => ({
              _id: id,
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

export const makeSNCFSRHook = makeConcurrentHook<SNCFEndpoints.Schedules | SNCFEndpoints.Stops>(
  (app) =>
    void app.externalAPIs.SNCF.endpoints[SNCFEndpoints.ScheduledRoutes]
      .fetch(true, app.get("debug"))
      .catch((err) => logger.warn(err)),
);
