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
import { DocumentType, mongoose } from "@typegoose/typegoose";
import { HydratedDocument } from "mongoose";
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

  return [
    await new Endpoint(
      TBMEndpoints.ScheduledRoutes,
      // Manual fetches only
      Infinity,
      async () => {
        const routeProjection = {
          _id: 1,
        } satisfies Partial<Record<keyof dbTBM_Lines_routes, 1>>;
        const routes = await TBM_lines_routesEndpointInstantiated.model
          .find<DocumentType<Pick<dbTBM_Lines_routes, keyof typeof routeProjection>>>({}, routeProjection)
          .lean();
        if (app.get("debug")) logger.debug(`Retrieved ${routes.length} lines routes`);

        const fillSchedule =
          (await TBM_schedulesRtEndpointInstantiated.model.findOne({ gid: Infinity })) ??
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

        const tripProjection = {
          _id: 1,
        } satisfies Partial<Record<keyof dbTBM_Trips, 1>>;

        const scheduleRtProjection = {
          _id: 1,
          hor_estime: 1,
          rs_sv_arret_p: 1,
        } satisfies Partial<Record<keyof dbTBM_Schedules_rt, 1>>;

        let tripsCount = 0;
        let schedulesCount = 0;

        const scheduledRoutes = new Array<dbTBM_ScheduledRoutes>(routes.length);
        for (const [i, route] of routes.entries()) {
          const relevantTrips = await TBM_tripsEndpointInstantiated.model
            .find<
              HydratedDocument<Pick<DocumentType<dbTBM_Trips>, keyof typeof tripProjection>>
            >({ rs_sv_chem_l: route._id }, tripProjection)
            .lean();
          tripsCount += relevantTrips.length;

          /** `[tripId, length of schedules]` */
          let maxLength: [number, number] | [null, -1] = [null, -1];
          let schedulesOfMaxLength: dbTBM_Schedules_rt["rs_sv_arret_p"][] = [];

          const formattedTrips = // Find schedules associated to each trip
            (
              await mapAsync(relevantTrips, async (t: (typeof relevantTrips)[number]) => {
                const schedules = await TBM_schedulesRtEndpointInstantiated.model
                  .find<
                    HydratedDocument<
                      Pick<
                        dbTBM_Schedules_rt & mongoose.Require_id<dbTBM_Schedules_rt>,
                        keyof typeof scheduleRtProjection
                      >
                    >
                  >({ rs_sv_cours_a: t._id, etat: { $ne: RtScheduleState.Annule } }, scheduleRtProjection)
                  .lean();
                schedulesCount += schedules.length;
                if (schedules.length > maxLength[1]) maxLength = [t._id, schedules.length];
                return {
                  tripId: t._id,
                  schedules: schedules.sort((a, b) => a.hor_estime.valueOf() - b.hor_estime.valueOf()),
                };
              })
            )
              .filter((t) => t.schedules.length)
              .sort(
                (a, b) =>
                  (a.schedules[a.schedules.length - 1].hor_estime?.valueOf() ?? 0) -
                  (b.schedules[b.schedules.length - 1].hor_estime?.valueOf() ?? 0),
              )
              // Add time, reduce memory
              .map(({ tripId, schedules }) => {
                if (maxLength[0] === tripId)
                  schedulesOfMaxLength = schedules.map((s) => s.rs_sv_arret_p as number);
                return {
                  tripId,
                  schedules: new Array<DocumentType<dbTBM_Schedules_rt>["_id"]>(
                    (maxLength[1] > -1 ? maxLength[1] : schedules.length) - schedules.length,
                  )
                    .fill(fillSchedule._id)
                    .concat(schedules.map(({ _id }) => _id)),
                };
              });

          scheduledRoutes[i] = {
            _id: route._id,
            trips: formattedTrips,
            stops: schedulesOfMaxLength,
          };
        }

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
