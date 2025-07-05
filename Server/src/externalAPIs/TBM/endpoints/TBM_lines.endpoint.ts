import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import TBM_Lines from "@bibm/data/models/TBM/TBM_lines.model";
import { Active, VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import { BaseTBM } from "..";
import { Application } from "../../../declarations";
import { bulkUpsertAndPurge } from "../../../utils";
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

        const lines = rawLines.map((line) => {
          return {
            _id: parseInt(line.properties.gid),
            libelle: line.properties.libelle,
            vehicule: line.properties.vehicule,
            active: line.properties.active,
          };
        });

        await bulkUpsertAndPurge(Line, lines, ["_id"]);

        return true;
      },
      Line,
    ).init(),
  ] as const;
};
