import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Schedules, {
  dbTBM_Schedules_rt,
  RtScheduleState,
  RtScheduleType,
} from "@bibm/data/models/TBM/TBM_schedules.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { logger } from "../../../logger";
import { bulkUpsertAndPurge } from "../../../utils";
import { Endpoint } from "../../endpoint";
import { makeSRHook } from "./TBMScheduledRoutes.endpoint";

export type TBM_Schedule = BaseTBM<{
  gid: string;
  hor_theo: string;
  rs_sv_arret_p: number;
  rs_sv_cours_a: number;
}>;

export type TBM_Schedule_rt = TBM_Schedule &
  BaseTBM<{
    hor_app: string;
    hor_estime: string;
    etat: RtScheduleState;
    type: RtScheduleType;
    tempsarret: number;
  }>;

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const [Schedule, ScheduleRt] = TBM_Schedules(app.get("sourceDBConn"));

  // Data needed
  return [
    await new Endpoint(
      TBMEndpoints.Schedules,
      24 * 3600,
      () => {
        return new Promise<true>((res) => res(true));
      },
      Schedule,
    ).init(),
    await new Endpoint(
      TBMEndpoints.Schedules_rt,
      // 10s in reality but it's of no use to be that precise because data treatment takes way more time...
      3 * 60,
      async () => {
        const rawSchedulesRt: TBM_Schedule_rt[] = await getData("sv_horai_a", [
          "filter=" +
            JSON.stringify({
              // ],
              etat: {
                $neq: "REALISE",
              },
            }),
        ]);

        const schedulesRt: dbTBM_Schedules_rt[] = rawSchedulesRt.map((scheduleRt) => {
          return {
            _id: parseInt(scheduleRt.properties.gid),
            realtime: true,
            hor_theo: new Date(scheduleRt.properties.hor_theo),
            hor_app: new Date(scheduleRt.properties.hor_app),
            hor_estime: new Date(scheduleRt.properties.hor_estime),
            etat: scheduleRt.properties.etat,
            type: scheduleRt.properties.type,
            rs_sv_arret_p: scheduleRt.properties.rs_sv_arret_p,
            rs_sv_cours_a: scheduleRt.properties.rs_sv_cours_a,
          };
        });

        const [bulked, { deletedCount }] = await bulkUpsertAndPurge(ScheduleRt, schedulesRt, ["_id"]);
        if (app.get("debug"))
          logger.debug(
            `Realtime schedules: updated ${bulked.upsertedCount}, inserted ${bulked.insertedCount} and deleted ${deletedCount}`,
          );

        return true;
      },
      ScheduleRt,
    )
      .registerHook(makeSRHook(app, TBMEndpoints.Schedules_rt))
      .init(),
  ] as const;
};
