import { TBMEndpoints } from "data/models/TBM/index";
import TBM_Schedules, {
  dbTBM_Schedules_rt,
  RtScheduleState,
  RtScheduleType,
} from "data/models/TBM/TBM_schedules.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";

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

export default async (app: Application, getData: <T>(id: string, queries: string[]) => Promise<T>) => {
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
      10,
      async () => {
        const date = new Date().toJSON().substring(0, 19);

        const rawSchedulesRt: TBM_Schedule_rt[] = await getData("sv_horai_a", [
          "filter=" +
            JSON.stringify({
              $or: [
                {
                  hor_theo: {
                    $gte: date,
                  },
                },
                {
                  hor_app: {
                    $gte: date,
                  },
                },
                {
                  hor_estime: {
                    $gte: date,
                  },
                },
              ],
              etat: {
                $neq: "REALISE",
              },
            }),
        ]);

        const SchedulesRt: dbTBM_Schedules_rt[] = rawSchedulesRt.map((scheduleRt) => {
          return {
            gid: parseInt(scheduleRt.properties.gid),
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

        await ScheduleRt.deleteMany({
          realtime: true,
          gid: { $nin: SchedulesRt.map((s) => s.gid) },
        });
        await ScheduleRt.bulkWrite(
          bulkOps("updateOne", SchedulesRt as unknown as Record<keyof dbTBM_Schedules_rt, unknown>[], [
            "gid",
            "realtime",
          ]),
        );

        return true;
      },
      ScheduleRt,
    )
      .init(),
  ] as const;
};
