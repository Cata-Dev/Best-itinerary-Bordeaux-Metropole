// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import type { Static } from "@feathersjs/typebox";
import { Type, getValidator } from "@feathersjs/typebox";

import { coords } from "@bibm/common/geographics";
import { SNCFEndpoints } from "@bibm/data/models/SNCF/index";
import { TBMEndpoints } from "@bibm/data/models/TBM/index";
import { dbTBM_Stops, StopType, VehicleType } from "@bibm/data/models/TBM/TBM_stops.model";
import type { HookContext } from "../../declarations";
import { defaultOptional } from "../../utils/schemas";
import { dataValidator, queryValidator } from "../../validators";
import type { GeocodeService } from "./geocode.class";

const AddressesObject = Type.Object(
  {
    code_postal: Type.Integer(),
    commune: Type.String(),
    fantoir: Type.String(),
    nom_voie: Type.String(),
    nom_voie_norm: Type.String(),
    numero: Type.Integer(),
    rep: Type.String(),
    type_voie: Type.String(),
  },
  { $id: "Addresses", additionalProperties: false },
);

const Addresses = Type.Literal(TBMEndpoints.Addresses);

export const TBMVehicles = Type.Enum(VehicleType);

const TBM_StopsObject = Type.Object(
  {
    type: Type.Enum(StopType),
    vehicule: TBMVehicles,
    libelle: Type.String(),
    libelle_lowercase: Type.String(),
    actif: Type.Union([Type.Literal(0), Type.Literal(1)]),
  },
  { $id: "TBM_Stops", additionalProperties: false },
);

const TBM_Stops = Type.Literal(TBMEndpoints.Stops);

const SNCF_StopsObject = Type.Object(
  {
    name: Type.String(),
    name_lowercase: Type.String(),
  },
  { $id: "SNCF_Stops", additionalProperties: false },
);

const SNCF_Stops = Type.Literal(SNCFEndpoints.Stops);

export const GEOCODE_type = Type.Union([Addresses, TBM_Stops, SNCF_Stops]);
export type GEOCODE_type = Static<typeof GEOCODE_type>;

const GeocodeBase = Type.Object(
  {
    _id: Type.Integer(),
    coords,
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
  },
  { additionalProperties: false },
);

// Main data model schema
export const geocodeSchema = Type.Union(
  [
    Type.Intersect([
      GeocodeBase,
      Type.Object(
        {
          GEOCODE_type: Addresses,
          dedicated: AddressesObject,
        },
        { additionalProperties: false },
      ),
    ]),
    Type.Intersect([
      GeocodeBase,
      Type.Object(
        {
          GEOCODE_type: TBM_Stops,
          dedicated: TBM_StopsObject,
        },
        { additionalProperties: false },
      ),
    ]),
    Type.Intersect([
      GeocodeBase,
      Type.Object(
        {
          GEOCODE_type: SNCF_Stops,
          dedicated: SNCF_StopsObject,
        },
        { additionalProperties: false },
      ),
    ]),
  ],
  { $id: "Geocode" },
);
export type Geocode = Static<typeof geocodeSchema>;
export const geocodeResolver = resolve<Geocode, HookContext<GeocodeService>>({});

export const geocodeExternalResolver = resolve<Geocode, HookContext<GeocodeService>>({});

// Schema for creating new entries
export const geocodeDataSchema = Type.Object(
  {},
  {
    $id: "GeocodeData",
  },
);
export type GeocodeData = Static<typeof geocodeDataSchema>;
export const geocodeDataValidator = getValidator(geocodeDataSchema, dataValidator);
export const geocodeDataResolver = resolve<Geocode, HookContext<GeocodeService>>({});

// Schema for updating existing entries
export const geocodePatchSchema = Type.Partial(geocodeDataSchema, {
  $id: "GeocodePatch",
});
export type GeocodePatch = Static<typeof geocodePatchSchema>;
export const geocodePatchValidator = getValidator(geocodePatchSchema, dataValidator);
export const geocodePatchResolver = resolve<Geocode, HookContext<GeocodeService>>({});

// Schema for allowed query properties
// Unused here, custom service without storage
export const geocodeQueryProperties = Type.Object({});
export const geocodeQuerySchema = Type.Optional(
  Type.Object(
    {
      id: Type.String(),
      uniqueVoies: defaultOptional(Type.Boolean({ default: false })),
      max: defaultOptional(Type.Integer({ default: 10 })),
    },
    { additionalProperties: false },
  ),
);
export type GeocodeQuery = Static<typeof geocodeQuerySchema>;
export const geocodeQueryValidator = getValidator(geocodeQuerySchema, queryValidator);
export const geocodeQueryResolver = resolve<GeocodeQuery, HookContext<GeocodeService>>({});
