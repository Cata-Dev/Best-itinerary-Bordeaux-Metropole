// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import type { Static } from "@feathersjs/typebox";
import { getValidator, ObjectIdSchema, Type } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";
import type { JourneyService } from "./journey.class";

import { coords } from "@bibm/common/geographics";
import { GEOCODE_type, geocodeSchema, TBMVehicles } from "../geocode/geocode.schema";
import { refreshDataQuerySchema } from "../refresh-data/refresh-data.schema";

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
  },
  { $id: "TBMStageDetails", additionalProperties: false },
);

const SNCFStageDetailsType = Type.Union([Type.Literal("TRAIN")]);

const SNCFStageDetails = Type.Object(
  {
    type: SNCFStageDetailsType,
    line: Type.String(),
    direction: Type.String(),
  },
  { $id: "SNCFStageDetails", additionalProperties: false },
);

export enum Transport {
  FOOT = "FOOT",
  TBM = "TBM",
  SNCF = "SNCF",
}
export const transport = Type.Enum(Transport);

const StageBase = Type.Object(
  {
    to: Type.String(),
    departure: Type.Integer(),
    duration: Type.Integer(),
  },
  { additionalProperties: false },
);

const Stage = Type.Union([
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: Type.Literal(Transport.FOOT),
        details: FOOTStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: Type.Literal(Transport.TBM),
        details: TBMStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
  Type.Intersect([
    StageBase,
    Type.Object(
      {
        type: Type.Literal(Transport.SNCF),
        details: SNCFStageDetails,
      },
      { additionalProperties: false },
    ),
  ]),
]);

// Main data model schema
export const journeySchema = Type.Object(
  {
    code: Type.Integer({ minimum: 200, maximum: 599 }),
    message: Type.String(),
    lastActualization: Type.Integer(),
    id: ObjectIdSchema(),
    from: Type.String(),
    departure: Type.Integer(),
    paths: Type.Array(
      Type.Object(
        {
          stages: Type.Array(Stage, { uniqueItems: true }),
        },
        { additionalProperties: false },
      ),
      { uniqueItems: true },
    ),
  },
  { $id: "Journey", additionalProperties: false },
);

export type Journey = Static<typeof journeySchema>;
export const journeyResolver = resolve<Journey, HookContext<JourneyService>>({});

export const journeyExternalResolver = resolve<Journey, HookContext<JourneyService>>({});

// Schema for creating new entries
export const journeyDataSchema = Type.Object(
  {},
  {
    $id: "JourneyData",
  },
);
export type JourneyData = Static<typeof journeyDataSchema>;
export const journeyDataValidator = getValidator(journeyDataSchema, dataValidator);
export const journeyDataResolver = resolve<Journey, HookContext<JourneyService>>({});

// Schema for updating existing entries
export const journeyPatchSchema = Type.Partial(journeyDataSchema, {
  $id: "JourneyPatch",
});
export type JourneyPatch = Static<typeof journeyPatchSchema>;
export const journeyPatchValidator = getValidator(journeyPatchSchema, dataValidator);
export const journeyPatchResolver = resolve<Journey, HookContext<JourneyService>>({});

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
export const journeyQuerySchema = Type.Union([
  Type.Intersect([
    Type.Object(
      {
        from: locationQuery,
        to: locationQuery,
        transports: Type.Optional(
          Type.Partial(
            Type.Record(Type.Union(transport.anyOf), Type.Boolean(), { additionalProperties: false }),
          ),
        ),
        departureTime: Type.Optional(Type.String()),
        maxWalkDistance: Type.Optional(Type.Integer()),
        walkSpeed: Type.Optional(Type.Number()),
      },
      { additionalProperties: false },
    ),

    Type.Optional(refreshDataQuerySchema),
  ]),
  // Must allow empty query for old result query (=> no query, only id)
  Type.Object({}, { additionalProperties: false }),
]);
export type JourneyQuery = Static<typeof journeyQuerySchema>;
export const journeyQueryValidator = getValidator(journeyQuerySchema, queryValidator);
export const journeyQueryResolver = resolve<JourneyQuery, HookContext<JourneyService>>({});
