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
import { makeTBMSRHook } from "./TBMScheduledRoutes.endpoint";

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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#the_epoch_timestamps_and_invalid_date
const MAX_SAFE_DATE = new Date(8_640_000_000_000_000);

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
                $nin: ["NON_RENSEIGNE", "ANNULE"],
              },
            }),
        ]);

        const schedulesRt: dbTBM_Schedules_rt[] = rawSchedulesRt.map((scheduleRt) => {
          const hor_theo = new Date(scheduleRt.properties.hor_theo);
          const hor_app = new Date(scheduleRt.properties.hor_app);
          const hor_estime = new Date(scheduleRt.properties.hor_estime);

          let theo = hor_theo.getTime() !== 0 ? hor_theo : MAX_SAFE_DATE;
          let estime =
            hor_estime.getTime() !== 0 ? hor_estime : hor_app.getTime() !== 0 ? hor_app : MAX_SAFE_DATE;

          // Prevent upper bound to be MAX_SAFE_DATE
          if (theo.getTime() < MAX_SAFE_DATE.getTime() && estime === MAX_SAFE_DATE) estime = theo;
          if (estime.getTime() < MAX_SAFE_DATE.getTime() && theo === MAX_SAFE_DATE) theo = estime;

          const int = (theo < estime ? [theo, estime] : [estime, theo]) satisfies [Date, Date];

          return {
            _id: parseInt(scheduleRt.properties.gid),
            realtime: true,
            hor_theo,
            hor_app,
            hor_estime,
            arr_int_hor: int,
            dep_int_hor: int,
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
      .registerHook(makeTBMSRHook(app, TBMEndpoints.Schedules_rt))
      .init(),
  ] as const;
};
