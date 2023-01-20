// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getDataValidator, getValidator } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";
import { refreshDataQuerySchema } from "../refresh-data/refresh-data.schema";

const FOOTStageDetails = Type.Object(
  {
    distance: Type.Integer(),
  },
  { $id: "FOOTStageDetails", additionalProperties: false },
);

export const TBMVehicles = Type.Union([Type.Literal("BUS"), Type.Literal("TRAM"), Type.Literal("BATEAU")]);

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
    paths: Type.Array(
      Type.Object(
        {
          id: Type.String(),
          totalDuration: Type.Integer(),
          totalDistance: Type.Integer(),
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
export const itineraryResolver = resolve<Itinerary, HookContext>({});

export const itineraryExternalResolver = resolve<Itinerary, HookContext>({});

// Schema for creating new entries
export const itineraryDataSchema = Type.Object(
  {},
  {
    $id: "ItineraryData",
  },
);
export type ItineraryData = Static<typeof itineraryDataSchema>;
export const itineraryDataValidator = getDataValidator(itineraryDataSchema, dataValidator);
export const itineraryDataResolver = resolve<Itinerary, HookContext>({});

// Schema for updating existing entries
export const itineraryPatchSchema = Type.Partial(itineraryDataSchema, {
  $id: "ItineraryPatch",
});
export type ItineraryPatch = Static<typeof itineraryPatchSchema>;
export const itineraryPatchValidator = getDataValidator(itineraryPatchSchema, dataValidator);
export const itineraryPatchResolver = resolve<Itinerary, HookContext>({});

// Schema for allowed query properties
export const itineraryQueryProperties = Type.Object({}, { additionalProperties: false });
export const itineraryQuerySchema = Type.Object(
  {
    from: Type.String(),
    to: Type.String(),
    transports: Type.Optional(Type.Record(Type.Union([FOOT, TBM, SNCF]), Type.Boolean(), { additionalProperties: false })),
    departureTime: Type.Optional(Type.String()),
    maxWalkDistance: Type.Optional(Type.Integer()),
    walkSpeed: Type.Optional(Type.Number()),
    ...refreshDataQuerySchema.properties,
  },
  { additionalProperties: false },
);
export type ItineraryQuery = Static<typeof itineraryQuerySchema>;
export const itineraryQueryValidator = getValidator(itineraryQuerySchema, queryValidator);
export const itineraryQueryResolver = resolve<ItineraryQuery, HookContext>({});
