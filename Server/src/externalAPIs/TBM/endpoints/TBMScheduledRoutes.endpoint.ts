import { DocumentType, mongoose } from "@typegoose/typegoose";
import { HydratedDocument } from "mongoose";
import { TBMEndpoints } from "..";
import { Application } from "../../../declarations";
import { bulkOps, mapAsync } from "../../../utils";
import { Endpoint } from "../../endpoint";
import {
  RtScheduleState,
  RtScheduleType,
  dbTBM_Schedules_rt,
} from "../../../../../Data/models/TBM/TBM_schedules.model";
import { dbTBM_Lines_routes } from "../../../../../Data/models/TBM/TBM_lines_routes.model";
import { dbTBM_Trips } from "../../../../../Data/models/TBM/TBM_trips.model";
import TBM_Scheduled_routes, {
  dbTBM_ScheduledRoutes,
} from "../../../../../Data/models/TBM/TBMScheduledRoutes.model";

export default (
  app: Application,
  TBM_lines_routesEndpointInstantiated: Endpoint<TBMEndpoints.Lines_routes>,
  TBM_schedulesRtEndpointInstantiated: Endpoint<TBMEndpoints.Schedules_rt>,
  TBM_tripsEndpointInstantiated: Endpoint<TBMEndpoints.Trips>,
) => {
  const ScheduledRoute = TBM_Scheduled_routes(app.get("mongooseClient"));

  return [
    new Endpoint(
      TBMEndpoints.ScheduledRoutes,
      Infinity,
      async () => {
        const routeProjection = {
          _id: 1,
        };
        const routes = (await TBM_lines_routesEndpointInstantiated.model
          .find<HydratedDocument<Pick<dbTBM_Lines_routes, keyof typeof routeProjection>>>({}, routeProjection)
          .lean()) as Pick<dbTBM_Lines_routes, keyof typeof routeProjection>[];

        const fillSchedule =
          (await TBM_schedulesRtEndpointInstantiated.model.findOne({ gid: Infinity })) ??
          (await TBM_schedulesRtEndpointInstantiated.model.create({
            gid: Infinity,
            hor_theo: new Date(8_640_000_000_000_000),
            hor_app: new Date(8_640_000_000_000_000),
            hor_estime: new Date(8_640_000_000_000_000),
            realtime: true,
            etat: RtScheduleState.Realise,
            type: RtScheduleType.Regulier,
            rs_sv_arret_p: Infinity,
            rs_sv_cours_a: Infinity,
          } as dbTBM_Schedules_rt));

        const tripProjection = {
          _id: 1,
        };

        const scheduleRtProjection = {
          _id: 1,
          hor_estime: 1,
          rs_sv_arret_p: 1,
        };

        const scheduledRoutes: dbTBM_ScheduledRoutes[] = new Array(routes.length);
        for (const [i, route] of routes.entries()) {
          const relevantTrips = await TBM_tripsEndpointInstantiated.model
            .find<
              HydratedDocument<Pick<DocumentType<dbTBM_Trips>, keyof typeof tripProjection>>
            >({ rs_sv_chem_l: route._id }, tripProjection)
            .lean();

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

        await ScheduledRoute.deleteMany({
          _id: { $nin: scheduledRoutes.map(({ _id }) => _id) },
        });

        await ScheduledRoute.bulkWrite(
          bulkOps("updateOne", scheduledRoutes as unknown as Record<keyof dbTBM_ScheduledRoutes, unknown>[]),
        );

        return true;
      },
      ScheduledRoute,
    ),
  ] as const;
};

export function TBMScheduledRoutesEndpointHook(app: Application) {
  const endpointsForScheduledRoutes = app.externalAPIs.TBM.endpoints.filter(
    (e) =>
      e.name === TBMEndpoints.Schedules_rt ||
      e.name === TBMEndpoints.Trips ||
      e.name === TBMEndpoints.Lines_routes ||
      e.name === TBMEndpoints.Stops,
  );
  const ScheduledRoutesEndpoint = app.externalAPIs.TBM.endpoints.find(
    (e) => e.name === TBMEndpoints.ScheduledRoutes,
  );
  let refreshAvoided = 0;
  const listener = (fetchedEndpoint: (typeof endpointsForScheduledRoutes)[number]) => (success: boolean) => {
    // If we should pass but we avoided a refresh, continue
    if (!success && refreshAvoided < (ScheduledRoutesEndpoint?.lastFetch ?? Infinity)) return;
    if (endpointsForScheduledRoutes.find((e) => e.name != fetchedEndpoint.name && e.fetching))
      return (refreshAvoided = Date.now());
    ScheduledRoutesEndpoint?.fetch(true, app.get("debug"));
  };
  endpointsForScheduledRoutes.forEach((e) => e.on("fetched", listener(e)));
}
