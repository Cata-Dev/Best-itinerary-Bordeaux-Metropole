import { BaseTBM, TBMEndpoints } from "..";
import { Application } from "../../../declarations";
import { bulkOps } from "../../../utils";
import { Endpoint } from "../../endpoint";
import TBM_Addresses, { dbAddresses } from "data/lib/models/TBM/addresses.model";

export type Addresse = BaseTBM<{
  nom_voie: string;
  gid: string;
  numero: number;
  rep: string | null;
  cpostal: string;
  /** Fichier annuaire topographique initialisé réduit */
  fantoir: string;
  commune: string;
  cinsee: `${number}${number}${number}`;
}> & {
  geometry: { coordinates: [number, number] };
};

export default (app: Application, getData: <T>(id: string, queries?: string[]) => Promise<T>) => {
  const Address = TBM_Addresses(app.get("mongooseClient"));

  return [
    new Endpoint(
      TBMEndpoints.Addresses,
      24 * 3600,
      async () => {
        const rawAddresses: Addresse[] = await getData("fv_adresse_p", ["crs=epsg:2154"]);

        const Addresses: dbAddresses[] = rawAddresses.map((address) => {
          const voie = address.properties.nom_voie;
          return {
            _id: parseInt(address.properties.gid),
            coords: address.geometry.coordinates,
            numero: address.properties.numero,
            rep: address.properties.rep?.toLowerCase(),
            type_voie: voie.match(/[A-zàÀ-ÿ]+/g)?.[0] ?? "",
            nom_voie: voie,
            nom_voie_lowercase: voie.toLowerCase(),
            code_postal:
              parseInt(address.properties.cpostal) || parseInt(`33${address.properties.cinsee}`) || 0,
            fantoir: address.properties.fantoir,
            commune: address.properties.commune,
          };
        });

        await Address.deleteMany({
          _id: { $nin: Addresses.map((i) => i._id) },
        });
        await Address.bulkWrite(
          bulkOps("updateOne", Addresses as unknown as Record<keyof dbAddresses, unknown>[]),
        );

        return true;
      },
      Address,
    ),
  ] as const;
};
