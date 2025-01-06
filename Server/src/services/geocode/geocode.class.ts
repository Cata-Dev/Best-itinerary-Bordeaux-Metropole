// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Params, ServiceInterface } from "@feathersjs/feathers";
import type { DocumentType } from "@typegoose/typegoose";
import type { Model } from "mongoose";

import type { Application } from "../../declarations";
import type { Geocode, GEOCODE_type, GeocodeData, GeocodePatch, GeocodeQuery } from "./geocode.schema";

export type { Geocode, GeocodeData, GeocodePatch, GeocodeQuery };

export interface GeocodeServiceOptions {
  app: Application;
}

type DistributedEndpoints<N extends EndpointName> = N extends unknown ? Endpoint<N> : never;

type DistributedProdiverClass<N extends EndpointName> = N extends unknown ? ProviderClass<N> : never;
type DistributedDocumentType<N extends EndpointName> = N extends unknown
  ? DocumentType<DistributedProdiverClass<N>>
  : never;

type DistributedFilterQuery<N extends EndpointName> = N extends unknown
  ? FilterQuery<DistributedDocumentType<N>>
  : never;

type ParsedId<N extends EndpointName> = [DistributedEndpoints<N>, DistributedFilterQuery<N>];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GeocodeParams extends Params<GeocodeQuery> {}

import { BadRequest, NotFound } from "@feathersjs/errors";
import { unique } from "common/filters";
import { normalize } from "common/string";
import { SNCFEndpoints } from "data/models/SNCF/index";
import { TBMEndpoints } from "data/models/TBM/index";
import { FilterQuery } from "mongoose";
import { EndpointName, ProviderClass } from "../../externalAPIs";
import { Endpoint } from "../../externalAPIs/endpoint";

type AddressRegexpGroups = "numero" | "commune" | "type_voie" | "nom_voie_norm" | "rep" | "code_postal";
interface FullAddressQuery {
  numero: number;
  nom_voie_norm: { $regex: string };
  commune: { $regex: string };
  type_voie: { $regex: string };
  rep: string;
  code_postal: number;
}
type AddressQuery = Partial<FullAddressQuery>;

export class GeocodeService<ServiceParams extends GeocodeParams = GeocodeParams>
  implements ServiceInterface<Geocode, GeocodeData, ServiceParams, GeocodePatch>
{
  private readonly app: Application;
  private communes: string[] = [];
  private communesNormalized: string[] = [];
  private types_voies: string[] = [];
  private reps: string[] = [];
  private addressRegexp = this.makeAddressRegexp();
  private dataRefreshed = 0;

  constructor(public options: GeocodeServiceOptions) {
    this.app = options.app;
  }

  private makeAddressRegexp() {
    return new RegExp(
      `(?<numero>\\d+ )?(?<rep>${this.reps
        .map((r) => r.toLowerCase() + " ")
        .join("|")})?((?<type_voie>${this.types_voies
        .map((tv) => tv.toLowerCase())
        .join("|")}) )?(?<nom_voie_norm>([a-z-']+ ?(?<commune>${this.communesNormalized.join(
        "|",
      )})?)+)( (?<code_postal>\\d{5}))?`,
    );
  }

  private async refreshInternalData() {
    const Addresses = this.app.externalAPIs.TBM.endpoints[TBMEndpoints.Addresses];
    this.communes = await Addresses.model.distinct("commune");
    this.communesNormalized = this.communes.map((c) => normalize(c));
    this.types_voies = await Addresses.model.distinct("type_voie");
    this.reps = await Addresses.model.distinct("rep", { rep: { $ne: null } });

    this.addressRegexp = this.makeAddressRegexp();
  }

  async parseId(id: string): Promise<ParsedId<GEOCODE_type>[]> {
    const TBM_Stops = this.app.externalAPIs.TBM.endpoints[TBMEndpoints.Stops];
    const SNCF_Stops = this.app.externalAPIs.SNCF.endpoints[SNCFEndpoints.Stops];

    id = normalize(id);

    const queries: ParsedId<GEOCODE_type>[] = [
      [TBM_Stops, { libelle_lowercase: { $regex: id } }],
      [SNCF_Stops, { name_lowercase: { $regex: id } }],
    ];

    if (
      this.dataRefreshed < this.app.externalAPIs.TBM.endpoints[TBMEndpoints.Addresses].lastFetch ||
      !this.communes.length
    )
      await this.refreshInternalData();

    const groups = this.addressRegexp.exec(id)?.groups as
      | Partial<Record<AddressRegexpGroups, string | undefined>>
      | undefined;

    if (groups) {
      const addressQuery: AddressQuery = {};

      if (groups.rep !== undefined) addressQuery.rep = groups.rep;
      if (groups.numero !== undefined) addressQuery.numero = parseInt(groups.numero);
      if (groups.code_postal !== undefined) addressQuery.code_postal = parseInt(groups.code_postal);
      if (groups.type_voie !== undefined || groups.nom_voie_norm !== undefined)
        addressQuery.nom_voie_norm = {
          $regex: `${groups.type_voie ?? ""} ${
            (groups.commune
              ? groups.nom_voie_norm?.replace(new RegExp(`${groups.commune}$`), "")
              : groups.nom_voie_norm) ?? ""
          }`.trim(),
        };
      if (groups.commune)
        addressQuery.commune = {
          // Get back the uppercase commune
          $regex: this.communes[this.communesNormalized.indexOf(groups.commune)],
        };
      if (groups.type_voie)
        addressQuery.type_voie = {
          // Get back the uppercase type_voie
          $regex: this.types_voies.find((v) => v.toLowerCase() == groups.type_voie)!,
        };

      queries.push([this.app.externalAPIs.TBM.endpoints[TBMEndpoints.Addresses], addressQuery]);
      console.log(queries[2][1]);
    }

    return queries;
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
      dedicated: (Object.keys(doc) as (keyof typeof doc)[]).reduce<object>(
        (acc, v) =>
          !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"]) ? { ...acc, [v]: doc[v] } : acc,
        {},
      ) as typeof GEOCODE_type extends TBMEndpoints.Addresses
        ? Omit<ProviderClass<TBMEndpoints.Addresses>, "_id" | "coords" | "GEOCODE_type">
        : typeof GEOCODE_type extends TBMEndpoints.Stops
          ? Omit<ProviderClass<TBMEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
          : typeof GEOCODE_type extends SNCFEndpoints.Stops
            ? Omit<ProviderClass<SNCFEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
            : never,
    };

    return result;
  }

  async find(_params?: ServiceParams): Promise<Geocode[]> {
    if (!_params || !_params.query) throw new BadRequest("Missing required query.");

    type doc = DistributedProdiverClass<GEOCODE_type> & { GEOCODE_type: GEOCODE_type };

    const docs: doc[] = [];
    for (const [endpoint, query] of await this.parseId(_params.query.id)) {
      try {
        const r: DistributedProdiverClass<GEOCODE_type>[] = await (endpoint.model as unknown as Model<object>)
          .find(query)
          .collation({ locale: "fr", strength: 1 })
          .limit(_params.query.max)
          .lean<DistributedProdiverClass<GEOCODE_type>[]>();
        if (r) {
          if (endpoint.name == TBMEndpoints.Addresses && _params.query.uniqueVoies)
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

    // Keep only wanted number of results
    docs.splice(_params.query.max);

    const results: Geocode[] = [];
    for (const doc of docs) {
      results.push({
        _id: doc._id,
        coords: doc.coords,
        GEOCODE_type: doc.GEOCODE_type,
        createdAt: doc.createdAt!.valueOf(),
        updatedAt: doc.updatedAt!.valueOf(),
        dedicated: (Object.keys(doc) as (keyof typeof doc)[]).reduce<object>(
          (acc, v) =>
            !(v in ["_id", "coords", "GEOCODE_type", "createdAt", "updatedAt"])
              ? { ...acc, [v]: doc[v] }
              : acc,
          {},
        ) as typeof doc.GEOCODE_type extends TBMEndpoints.Addresses
          ? Omit<ProviderClass<TBMEndpoints.Addresses>, "_id" | "coords" | "GEOCODE_type">
          : typeof doc.GEOCODE_type extends TBMEndpoints.Stops
            ? Omit<ProviderClass<TBMEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
            : typeof doc.GEOCODE_type extends SNCFEndpoints.Stops
              ? Omit<ProviderClass<SNCFEndpoints.Stops>, "_id" | "coords" | "GEOCODE_type">
              : never,
      });
    }

    return results;
  }
}

function filterUniqueVoies<T extends ProviderClass<TBMEndpoints.Addresses>>(results: T[]) {
  const voies = results.map((r) => r.nom_voie_norm);
  const uniquesVoies = voies.filter(unique);
  return uniquesVoies.map((uv) => {
    const min = Math.min(...results.filter((r) => r.nom_voie_norm === uv).map((r) => r.numero));
    return results.find((r) => r.nom_voie_norm === uv && r.numero === min)!;
  });
}

export const getOptions = (app: Application) => {
  return { app };
};
