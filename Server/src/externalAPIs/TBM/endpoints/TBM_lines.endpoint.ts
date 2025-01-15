import { TBMEndpoints } from "data/models/TBM/index";
import TBM_Lines from "data/models/TBM/TBM_lines.model";
import { Active, VehicleType } from "data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";

export type TBM_Line = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  active: Active;
}>;

export default async (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Line = TBM_Lines(app.get("sourceDBConn"));

  return [
    await new Endpoint(
      TBMEndpoints.Lines,
      24 * 3600,
      async () => {
        const rawLines: TBM_Line[] = await getData("sv_ligne_a");

        const Lines = rawLines.map((line) => {
          return {
            _id: parseInt(line.properties.gid),
            libelle: line.properties.libelle,
            vehicule: line.properties.vehicule,
            active: line.properties.active,
          };
        });

        await Line.deleteMany({ _id: { $nin: Lines.map((l) => l._id) } });
        await Line.bulkWrite(bulkOps("updateOne", Lines));

        return true;
      },
      Line,
    ).init(),
  ] as const;
};
