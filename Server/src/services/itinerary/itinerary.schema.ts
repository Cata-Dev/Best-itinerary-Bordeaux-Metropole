// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { ObjectIdSchema, Type, getValidator } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";
import type { ItineraryService } from "./itinerary.class";

import { refreshDataQuerySchema } from "../refresh-data/refresh-data.schema";
import { coords, GEOCODE_type, geocodeSchema, TBMVehicles } from "../geocode/geocode.schema";

const FOOTStageDetails = Type.Object(
  {
    distance: Type.Integer(),
  },
  { $id: "FOOTStageDetails", additionalProperties: false },
);

const TBMStageDetails = Type.Object(
  {
    type: TBMVehicles,
    line: Type.String(),
    direction: Type.String(),
    departure: Type.Integer(),
  },
  { $id: "TBMStageDetails", additionalProperties: false },
);

const SNCFStageDetailsType = Type.Union([Type.Literal("TRAIN")]);

const SNCFStageDetails = Type.Object(
  {
    type: SNCFStageDetailsType,
    line: Type.String(),
    direction: Type.String(),
    departure: Type.Integer(),
  },
  { $id: "SNCFStageDetails", additionalProperties: false },
);

const FOOT = Type.Literal("FOOT");
const TBM = Type.Literal("TBM");
const SNCF = Type.Literal("SNCF");

const StageBase = Type.Object(
  {
    to: Type.String(),
    duration: Type.Integer(),
  },
  { additionalProperties: false },
);

const Stage = Type.Union([
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: FOOT,
        details: FOOTStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: TBM,
        details: TBMStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: SNCF,
        details: SNCFStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
]);

// Main data model schema
export const itinerarySchema = Type.Object(
  {
    code: Type.Integer({ minimum: 200, maximum: 599 }),
    message: Type.String(),
    lastActualization: Type.Integer(),
    id: ObjectIdSchema(),
    paths: Type.Array(
      Type.Object(
        {
          departure: Type.Integer(),
          from: Type.String(),
          stages: Type.Array(Stage, { uniqueItems: true }),
        },
        { additionalProperties: false },
      ),
      { uniqueItems: true },
    ),
  },
  { $id: "Itinerary", additionalProperties: false },
);

export type Itinerary = Static<typeof itinerarySchema>;
export const itineraryResolver = resolve<Itinerary, HookContext<ItineraryService>>({});

export const itineraryExternalResolver = resolve<Itinerary, HookContext<ItineraryService>>({});

// Schema for creating new entries
export const itineraryDataSchema = Type.Object(
  {},
  {
    $id: "ItineraryData",
  },
);
export type ItineraryData = Static<typeof itineraryDataSchema>;
export const itineraryDataValidator = getValidator(itineraryDataSchema, dataValidator);
export const itineraryDataResolver = resolve<Itinerary, HookContext<ItineraryService>>({});

// Schema for updating existing entries
export const itineraryPatchSchema = Type.Partial(itineraryDataSchema, {
  $id: "ItineraryPatch",
});
export type ItineraryPatch = Static<typeof itineraryPatchSchema>;
export const itineraryPatchValidator = getValidator(itineraryPatchSchema, dataValidator);
export const itineraryPatchResolver = resolve<Itinerary, HookContext<ItineraryService>>({});

// Schema for allowed query properties
// Unused here, custom service without storage
export const itineraryQueryProperties = Type.Object({});
const locationQuery = Type.Object(
  {
    type: GEOCODE_type,
    coords,
    // Would be a mapped type https://github.com/sinclairzx81/typebox?tab=readme-ov-file#types-mapped but not yet in @feathersjs/typebox
    id: Type.Union([
      geocodeSchema.anyOf[0].properties._id,
      geocodeSchema.anyOf[1].properties._id,
      geocodeSchema.anyOf[2].properties._id,
    ]),
    alias: Type.String(),
  },
  { additionalProperties: false },
);
export const itineraryQuerySchema = Type.Intersect(
  [
    Type.Object(
      {
        from: locationQuery,
        to: locationQuery,
        transports: Type.Optional(
          Type.Partial(
            Type.Record(Type.Union([FOOT, TBM, SNCF]), Type.Boolean(), { additionalProperties: false }),
          ),
        ),
        departureTime: Type.Optional(Type.String()),
        maxWalkDistance: Type.Optional(Type.Integer()),
        walkSpeed: Type.Optional(Type.Number()),
      },
      { additionalProperties: false },
    ),
    refreshDataQuerySchema,
  ],
  { additionalProperties: false },
);
export type ItineraryQuery = Static<typeof itineraryQuerySchema>;
export const itineraryQueryValidator = getValidator(itineraryQuerySchema, queryValidator);
export const itineraryQueryResolver = resolve<ItineraryQuery, HookContext<ItineraryService>>({});
