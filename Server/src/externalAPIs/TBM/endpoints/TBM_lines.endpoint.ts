import { BaseTBM, TBMEndpoints } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";
import TBM_Lines from "../models/TBM_lines.model";
import { VehicleType, Active } from "../models/TBM_stops.model";

export type TBM_Line = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  active: Active;
}>;

export default (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Line = TBM_Lines(app);

  return [
    new Endpoint(
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
    ),
  ] as const;
};
