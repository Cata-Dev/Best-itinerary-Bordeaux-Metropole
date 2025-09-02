// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import type { Static } from "@feathersjs/typebox";
import { getValidator, ObjectIdSchema, Type } from "@feathersjs/typebox";

import { coords } from "@bibm/common/geographics";
import type { HookContext } from "../../declarations";
import { defaultOptional } from "../../utils/schemas";
import { dataValidator, queryValidator } from "../../validators";
import { Transport } from "../journey/journey.schema";
import type { PathService } from "./path.class";

const pathSchemaBase = Type.Object(
  {
    steps: Type.Union([
      Type.Array(coords),
      // Real shape coords, MultiLine String
      Type.Array(Type.Array(coords)),
    ]),
  },
  { $id: "Path", additionalProperties: false },
);

// Main data model schema
export const pathSchema = Type.Union([
  Type.Intersect(
    [pathSchemaBase, Type.Object({ type: Type.Literal(Transport.FOOT), length: Type.Number() })],
    {
      additionalProperties: false,
    },
  ),
  Type.Intersect([pathSchemaBase, Type.Object({ type: Type.Literal(Transport.TBM), line: Type.Number() })], {
    additionalProperties: false,
  }),
  Type.Intersect([pathSchemaBase, Type.Object({ type: Type.Literal(Transport.SNCF), line: Type.String() })], {
    additionalProperties: false,
  }),
]);
export type Path = Static<typeof pathSchema>;
export const pathValidator = getValidator(pathSchema, dataValidator);
export const pathResolver = resolve<Path, HookContext<PathService>>({});

export const pathExternalResolver = resolve<Path, HookContext<PathService>>({});

// Schema for creating new entries
export const pathDataSchema = Type.Object(
  {},
  {
    $id: "PathData",
  },
);
export type PathData = Static<typeof pathDataSchema>;
export const pathDataValidator = getValidator(pathDataSchema, dataValidator);
export const pathDataResolver = resolve<Path, HookContext<PathService>>({});

// Schema for updating existing entries
export const pathPatchSchema = Type.Object({}, { additionalProperties: false });
export type PathPatch = Static<typeof pathPatchSchema>;
export const pathPatchValidator = getValidator(pathPatchSchema, dataValidator);
export const pathPatchResolver = resolve<Path, HookContext<PathService>>({});

const commonQuery = Type.Object(
  {
    realShape: defaultOptional(Type.Boolean({ default: true })),
  },
  { additionalProperties: false },
);
export const pathQuerySchema = Type.Union([
  // Direct foot path computation
  Type.Intersect([
    Type.Object(
      {
        from: coords,
        to: coords,
      },
      { additionalProperties: false },
    ),
    commonQuery,
  ]),
  // PTN line path
  Type.Intersect([
    Type.Object(
      {
        // Line route ID
        line: Type.Union([Type.Number(), Type.String()]),
        // Stop IDs
        from: Type.Number(),
        to: Type.Number(),
      },
      { additionalProperties: false },
    ),
  ]),
  // Foot path computation(s) from an already computed journey referenced by "id"
  Type.Intersect([
    Type.Object({
      for: Type.Literal("journey"),
      id: ObjectIdSchema(),
      index: Type.Integer(),
    }),
    commonQuery,
  ]),
]);
export type PathQuery = Static<typeof pathQuerySchema>;
export const pathQueryValidator = getValidator(pathQuerySchema, queryValidator);
export const pathQueryResolver = resolve<PathQuery, HookContext<PathService>>({});
