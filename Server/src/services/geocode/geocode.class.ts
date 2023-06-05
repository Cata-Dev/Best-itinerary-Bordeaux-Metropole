// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Params, ServiceInterface } from "@feathersjs/feathers";
import type { Model } from "mongoose";
import type { DocumentType } from "@typegoose/typegoose";

import type { Application } from "../../declarations";
import type { Geocode, GeocodeData, GeocodePatch, GeocodeQuery, GEOCODE_type } from "./geocode.schema";

export type { Geocode, GeocodeData, GeocodePatch, GeocodeQuery };

export interface GeocodeServiceOptions {
  app: Application;
}

type DistributedEndpoints<N extends EndpointName> = N extends any ? Endpoint<N> : never;

type DistributedProdiverClass<N extends EndpointName> = N extends any ? ProviderClass<N> : never;
type DistributedDocumentType<N extends EndpointName> = N extends any
  ? DocumentType<DistributedProdiverClass<N>>
  : never;

type DistributedFilterQuery<N extends EndpointName> = N extends any
  ? FilterQuery<DistributedDocumentType<N>>
  : never;

type parsedId<N extends EndpointName> = [DistributedEndpoints<N>, DistributedFilterQuery<N>];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GeocodeParams extends Params<GeocodeQuery> {}

import { NotFound, BadRequest } from "@feathersjs/errors";
import { FilterQuery } from "mongoose";
import { EndpointName, ProviderClass } from "../../externalAPIs";
import { Endpoint } from "../../externalAPIs/endpoint";
import { unique } from "../../utils";
import { TBMEndpoints } from "../../externalAPIs/TBM";
import { SNCFEndpoints } from "../../externalAPIs/SNCF";

export class GeocodeService<ServiceParams extends Params = GeocodeParams>
  implements ServiceInterface<Geocode, GeocodeData, ServiceParams, GeocodePatch>
{
  private readonly app: Application;
  private communes: string[] = [];
  private communesNormalized: string[] = [];
  private types_voies: string[] = [];
  private reps: string[] = [];
  private dataRefreshed = 0;

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

  async parseId(id: string): Promise<parsedId<GEOCODE_type>[]> {
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
    if (
      this.dataRefreshed <
        (
          this.app.externalAPIs.endpoints.find(
            (e) => e.name === TBMEndpoints.Addresses,
          ) as Endpoint<TBMEndpoints.Addresses>
        ).lastFetch ||
      !this.communes.length
    )
      await this.refreshInternalData();
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
      const filteredGroups = (Object.keys(groups) as groups[]).reduce<object>(
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

      return [
        [
          this.app.externalAPIs.endpoints.find(
            (e) => e.name === TBMEndpoints.Addresses,
          ) as Endpoint<TBMEndpoints.Addresses>,
          addressQuery,
        ],
        [TBM_Stops, { libelle_lowercase: { $regex: id } }],
        [SNCF_Stops, { name_lowercase: { $regex: id } }],
      ];
    } else {
      return [
        [TBM_Stops, { libelle_lowercase: { $regex: id } }],
        [SNCF_Stops, { name_lowercase: { $regex: id } }],
      ];
    }
  }

  async get(id: string /* _params?: ServiceParams */): Promise<Geocode> {
    let doc: DistributedProdiverClass<GEOCODE_type> | null = null;
    let GEOCODE_type: GEOCODE_type = "" as never;

    for (const [endpoint, query] of await this.parseId(id)) {
      try {
        doc = await (endpoint.model as unknown as Model<object>)
          .findOne(query)
          .collation({ locale: "fr", strength: 1 })
          .lean<DistributedProdiverClass<GEOCODE_type>>();
        if (doc) {
          GEOCODE_type = endpoint.name;
          break;
        }
      } catch (_) {}
    }

    if (!doc) throw new NotFound(`no result found for ${id}`);

    const result = {
      _id: doc._id,
      coords: doc.coords,
      GEOCODE_type,
      createdAt: doc.createdAt!.valueOf(),
      updatedAt: doc.updatedAt!.valueOf(),
      dedicated: {
        ...((Object.keys(doc) as (keyof typeof doc)[]).reduce<object>(
          (acc, v) =>
            !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"])
              ? { ...acc, [v]: doc![v] }
              : acc,
          {},
        ) as typeof GEOCODE_type extends TBMEndpoints.Addresses
          ? Omit<ProviderClass<TBMEndpoints.Addresses>, "_id" | "coords" | "GEOCODE_type">
          : typeof GEOCODE_type extends TBMEndpoints.Stops
          ? Omit<ProviderClass<TBMEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
          : typeof GEOCODE_type extends SNCFEndpoints.Stops
          ? Omit<ProviderClass<SNCFEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
          : any),
      },
    };

    return result;
  }

  async find(_params?: ServiceParams): Promise<Geocode[]> {
    if (!_params || _params.query?.id === undefined) throw new BadRequest("missing id parameter in query");

    type doc = DistributedProdiverClass<GEOCODE_type> & { GEOCODE_type: GEOCODE_type };

    let docs: doc[] = [];
    for (const [endpoint, query] of await this.parseId(_params.query.id)) {
      try {
        const r: DistributedProdiverClass<GEOCODE_type>[] = await (endpoint.model as unknown as Model<object>)
          .find(query)
          .collation({ locale: "fr", strength: 1 })
          .limit(500)
          .lean<DistributedProdiverClass<GEOCODE_type>[]>();
        if (r) {
          if (endpoint.name == TBMEndpoints.Addresses && _params.query?.uniqueVoies)
            docs.push(
              ...filterUniqueVoies(
                (r as ProviderClass<TBMEndpoints.Addresses>[]).map((r) => ({
                  ...r,
                  GEOCODE_type: endpoint.name,
                })),
              ),
            );
          else
            docs.push(
              ...r.map((r) => ({
                ...r,
                GEOCODE_type: endpoint.name,
              })),
            );
        }
      } catch (_) {}
    }

    if (!docs.length) return [];

    if (_params.query.max) docs = docs.slice(0, Number(_params.query.max));

    const results: Geocode[] = [];
    for (const doc of docs) {
      results.push({
        _id: doc._id,
        coords: doc.coords,
        GEOCODE_type: doc.GEOCODE_type,
        createdAt: doc.createdAt!.valueOf(),
        updatedAt: doc.updatedAt!.valueOf(),
        dedicated: {
          ...((Object.keys(doc) as (keyof typeof doc)[]).reduce<object>(
            (acc, v) =>
              !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"])
                ? { ...acc, [v]: doc![v] }
                : acc,
            {},
          ) as typeof doc.GEOCODE_type extends TBMEndpoints.Addresses
            ? Omit<ProviderClass<TBMEndpoints.Addresses>, "_id" | "coords" | "GEOCODE_type">
            : typeof doc.GEOCODE_type extends TBMEndpoints.Stops
            ? Omit<ProviderClass<TBMEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
            : typeof doc.GEOCODE_type extends SNCFEndpoints.Stops
            ? Omit<ProviderClass<SNCFEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
            : any),
        },
      });
    }

    return results;
  }
}

function filterUniqueVoies<T extends ProviderClass<TBMEndpoints.Addresses>>(results: T[]) {
  const voies = results.map((r) => r.nom_voie_lowercase);
  const uniquesVoies = voies.filter(unique);
  return uniquesVoies.map((uv) => {
    const min = Math.min(...results.filter((r) => r.nom_voie_lowercase === uv).map((r) => r.numero));
    return results.find((r) => r.nom_voie_lowercase === uv && r.numero === min) as T;
  });
}

export const getOptions = (app: Application) => {
  return { app };
};
