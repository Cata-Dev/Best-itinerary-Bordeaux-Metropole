/* eslint-disable no-empty */
import type { Params } from "@feathersjs/feathers";
import { resolveAll } from "@feathersjs/schema";

import type { GeocodeResult, GeocodeQuery, GEOCODE_type } from "./geocode.schema";
import { geocodeResolvers } from "./geocode.resolver";

export const geocodeHooks = {
  around: {
    all: [resolveAll(geocodeResolvers)],
  },
  before: {},
  after: {},
  error: {},
};

import { Application } from "../../declarations";

export interface GeocodeServiceOptions {
  app: Application;
}

import { NotFound, BadRequest } from "@feathersjs/errors";
import { FilterQuery } from "mongoose";
import { ProviderSchema } from "../../externalAPIs";
import { Endpoint } from "../../externalAPIs/endpoint";
import { dbAddresses } from "../../externalAPIs/TBM/models/addresses.model";
import { unique } from "../../utils";
import { dbTBM_Stops } from "../../externalAPIs/TBM/models/TBM_stops.model";
import { dbSNCF_Stops } from "../../externalAPIs/SNCF/models/SNCF_stops.model";
import { TBMEndpoints } from "../../externalAPIs/TBM";
import { SNCFEndpoints } from "../../externalAPIs/SNCF";

// By default calls the standard MongoDB adapter service methods but can be customized with your own functionality.
export class GeocodeService {
  private readonly app: Application;
  private communes: string[] = [];
  private communesNormalized: string[] = [];
  private types_voies: string[] = [];
  private reps: string[] = [];

  constructor(public options: GeocodeServiceOptions) {
    this.app = options.app;
  }

  async refreshInternalData() {
    const Addresses = this.app.externalAPIs.endpoints.find(
      (e) => e.name === TBMEndpoints.Addresses,
    ) as Endpoint<TBMEndpoints.Addresses>;
    this.communes = await Addresses.model.distinct("commune");
    this.communesNormalized = this.communes.map((c) =>
      c
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, ""),
    );
    this.types_voies = await Addresses.model.distinct("type_voie");
    this.reps = await Addresses.model.distinct("rep", { rep: { $ne: null } });
  }

  async parseId(id: string): Promise<{
    endpoints: Endpoint<GEOCODE_type>[];
    queries: FilterQuery<ProviderSchema>[];
  }> {
    const TBM_Stops = this.app.externalAPIs.endpoints.find(
      (e) => e.name === TBMEndpoints.Stops,
    ) as Endpoint<TBMEndpoints.Stops>;
    const SNCF_Stops = this.app.externalAPIs.endpoints.find(
      (e) => e.name == SNCFEndpoints.Stops,
    ) as Endpoint<SNCFEndpoints.Stops>;

    id = id
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (!this.communes) await this.refreshInternalData();
    type groups = "numero" | "commune" | "type_voie" | "nom_voie_lowercase" | "rep" | "code_postal";
    const regexpStr = `(?<numero>\\d+ )?(?<rep>${this.reps
      .map((r) => r.toLowerCase() + " ")
      .join("|")})?(?<type_voie>${this.types_voies
      .map((tv) => tv.toLowerCase() + " ?")
      .join("|")})?(?<nom_voie_lowercase>([a-zà-ÿ-']+ ?(?<commune>${this.communesNormalized
      .map((c) => c + " ?")
      .join("|")})?)+)(?<code_postal>\\d{5})?`;
    const groups = id.match(new RegExp(regexpStr))?.groups as
      | Partial<{ [k in groups]: string | undefined }>
      | undefined;

    interface FullAddressQuery {
      numero: number;
      nom_voie_lowercase: { $regex: string };
      commune: { $regex: string };
      type_voie: { $regex: string };
      rep: string;
      code_postal: number;
    }
    type AddressQuery = Partial<FullAddressQuery>;

    if (groups) {
      const filteredGroups = (Object.keys(groups) as groups[]).reduce(
        (acc, v) => (groups![v] !== undefined ? { ...acc, [v]: groups![v] } : acc),
        {},
      ) as Partial<{ [k in groups]: string }>;
      let k: keyof typeof filteredGroups;
      for (k in filteredGroups) {
        if (filteredGroups[k] === undefined) delete filteredGroups[k];
        else filteredGroups[k] = filteredGroups[k]!.trim();
      }
      const addressQuery: AddressQuery = {};
      if (filteredGroups.rep !== undefined) addressQuery.rep = filteredGroups.rep;
      if (filteredGroups.numero !== undefined) addressQuery.numero = parseInt(filteredGroups.numero);
      if (filteredGroups.code_postal !== undefined)
        addressQuery.code_postal = parseInt(filteredGroups.code_postal);
      if (filteredGroups.type_voie !== undefined || filteredGroups.nom_voie_lowercase !== undefined)
        addressQuery.nom_voie_lowercase = {
          $regex: `${filteredGroups.type_voie || ""} ${
            (filteredGroups.commune
              ? filteredGroups.nom_voie_lowercase?.replace(new RegExp(`${filteredGroups.commune}$`), "")
              : filteredGroups.nom_voie_lowercase) || ""
          }`.trim(),
        };
      if (filteredGroups.commune)
        addressQuery.commune = {
          $regex: this.communes[this.communesNormalized.indexOf(filteredGroups.commune)],
        }; //get back the uppercase commune
      if (filteredGroups.type_voie)
        addressQuery.type_voie = {
          $regex: this.types_voies.find((v) => v.toLowerCase() == filteredGroups.type_voie) as string,
        }; //get back the uppercase type_voie

      return {
        endpoints: [
          this.app.externalAPIs.endpoints.find(
            (e) => e.name === TBMEndpoints.Addresses,
          ) as Endpoint<TBMEndpoints.Addresses>,
          TBM_Stops,
          SNCF_Stops,
        ],
        queries: [addressQuery, { libelle_lowercase: { $regex: id } }, { name_lowercase: { $regex: id } }],
      };
    } else {
      return {
        endpoints: [TBM_Stops, SNCF_Stops],
        queries: [{ libelle_lowercase: { $regex: id } }, { name_lowercase: { $regex: id } }],
      };
    }
  }

  async get(id: string /* _params?: Params<GeocodeQuery> */): Promise<GeocodeResult> {
    const { queries, endpoints } = await this.parseId(id);

    let doc:
      | ((dbAddresses | dbTBM_Stops | dbSNCF_Stops) & {
          createdAt: Date;
          updatedAt: Date;
        })
      | null = null;
    let GEOCODE_type: GEOCODE_type = "" as never;
    for (const i in endpoints) {
      try {
        doc = await endpoints[i].model.findOne(queries[i]).collation({ locale: "fr", strength: 1 }).lean();
        if (doc) {
          GEOCODE_type = endpoints[0].name;
          break;
        }
      } catch (_) {}
    }

    if (!doc) throw new NotFound(`no result found for ${id}`);
    const result = {
      _id: doc._id,
      coords: doc.coords,
      GEOCODE_type,
      createdAt: doc.createdAt.valueOf(),
      updatedAt: doc.updatedAt.valueOf(),
      dedicated: {
        ...((Object.keys(doc) as (keyof typeof doc)[]).reduce(
          (acc, v) =>
            !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"])
              ? { ...acc, [v]: doc![v] }
              : acc,
          {},
        ) as typeof GEOCODE_type extends TBMEndpoints.Addresses
          ? Omit<dbAddresses, "_id" | "coords" | "GEOCODE_type">
          : typeof GEOCODE_type extends TBMEndpoints.Stops
          ? Omit<dbTBM_Stops, "_id" | "coords" | "GEOCODE_type">
          : typeof GEOCODE_type extends SNCFEndpoints.Stops
          ? Omit<dbSNCF_Stops, "_id" | "coords" | "GEOCODE_type">
          : any),
      },
    };

    return result;
  }

  async find(_params: Params<GeocodeQuery>): Promise<GeocodeResult[]> {
    if (_params.query?.id === undefined) throw new BadRequest("missing id parameter in query");
    const { queries, endpoints } = await this.parseId(_params.query.id);

    const results: GeocodeResult[] = [];

    type doc = (dbAddresses | dbTBM_Stops | dbSNCF_Stops) & {
      createdAt: Date;
      updatedAt: Date;
    } & { GEOCODE_type: GEOCODE_type };

    let docs: doc[] = [];
    for (const i in endpoints) {
      try {
        let r = (await endpoints[i].model
          .find(queries[i])
          .collation({ locale: "fr", strength: 1 })
          .limit(500)
          .lean()) as doc[];
        if (r) {
          r = r.map((r) => {
            r.GEOCODE_type = endpoints[i].name;
            return r;
          });
          if (endpoints[i].name == TBMEndpoints.Addresses && _params.query?.uniqueVoies)
            r = filterUniqueVoies(
              r as (dbAddresses & {
                createdAt: Date;
                updatedAt: Date;
              } & { GEOCODE_type: GEOCODE_type })[],
            );
          docs.push(...r);
        }
      } catch (_) {}
    }

    if (!docs.length) return [];

    if (_params.query.max) docs = docs.slice(0, Number(_params.query.max));

    for (const doc of docs) {
      results.push({
        _id: doc._id,
        coords: doc.coords,
        GEOCODE_type: doc.GEOCODE_type,
        createdAt: doc.createdAt.valueOf(),
        updatedAt: doc.updatedAt.valueOf(),
        dedicated: {
          ...((Object.keys(doc) as (keyof typeof doc)[]).reduce(
            (acc, v) =>
              !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"])
                ? { ...acc, [v]: doc![v] }
                : acc,
            {},
          ) as typeof doc.GEOCODE_type extends TBMEndpoints.Addresses
            ? Omit<dbAddresses, "_id" | "coords" | "GEOCODE_type">
            : typeof doc.GEOCODE_type extends TBMEndpoints.Stops
            ? Omit<dbTBM_Stops, "_id" | "coords" | "GEOCODE_type">
            : typeof doc.GEOCODE_type extends SNCFEndpoints.Stops
            ? Omit<dbSNCF_Stops, "_id" | "coords" | "GEOCODE_type">
            : any),
        },
      });
    }

    return results;
  }
}

function filterUniqueVoies<T extends dbAddresses>(results: T[]) {
  const voies = results.map((r) => r.nom_voie_lowercase);
  const uniquesVoies = voies.filter(unique);
  return uniquesVoies.map((uv) => {
    const min = Math.min(...results.filter((r) => r.nom_voie_lowercase === uv).map((r) => r.numero));
    return results.find((r) => r.nom_voie_lowercase === uv && r.numero === min) as T;
  });
}
