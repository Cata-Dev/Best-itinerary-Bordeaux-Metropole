// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from "@feathersjs/schema";
import { Type, getValidator } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";
import type { PathService } from "./path.class";
import { coords } from "../geocode/geocode.schema";

// Main data model schema
export const pathSchema = Type.Object(
  {
    length: Type.Number(),
    steps: Type.Array(coords),
  },
  { $id: "Path", additionalProperties: false },
);
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
export const pathPatchSchema = Type.Partial(pathSchema, {
  $id: "PathPatch",
});
export type PathPatch = Static<typeof pathPatchSchema>;
export const pathPatchValidator = getValidator(pathPatchSchema, dataValidator);
export const pathPatchResolver = resolve<Path, HookContext<PathService>>({});

export const pathQuerySchema = Type.Object(
  {
    from: coords,
    to: coords,
  },
  { additionalProperties: false },
);
export type PathQuery = Static<typeof pathQuerySchema>;
export const pathQueryValidator = getValidator(pathQuerySchema, queryValidator);
export const pathQueryResolver = resolve<PathQuery, HookContext<PathService>>({});
