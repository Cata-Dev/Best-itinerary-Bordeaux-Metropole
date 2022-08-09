import { schema } from "@feathersjs/schema";
import type { Infer } from "@feathersjs/schema";

// Schema for the basic data model (e.g. creating new entries)
export const refreshDataDataSchema = schema({
  $id: "RefreshDataData",
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
} as const);

export type RefreshDataData = Infer<typeof refreshDataDataSchema>;

// Schema for making partial updates
export const refreshDataPatchSchema = schema({
  $id: "RefreshDataPatch",
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    ...refreshDataDataSchema.properties,
  },
} as const);

export type RefreshDataPatch = Infer<typeof refreshDataPatchSchema>;

// Schema for the data that is being returned
export const refreshDataResultSchema = schema({
  $id: "RefreshDataResult",
  type: "object",
  additionalProperties: false,
  required: [...refreshDataDataSchema.required, "actualized", "lastActualization"],
  properties: {
    ...refreshDataDataSchema.properties,
    actualized: {
      oneOf: [{ type: "number" }, { type: "boolean" }, { type: "null" }],
    },
    lastActualization: {
      type: "integer",
    },
  },
} as const);

export type RefreshDataResult = Infer<typeof refreshDataResultSchema>;

// Schema for allowed query properties
export const refreshDataQuerySchema = schema({
  $id: "RefreshDataQuery",
  type: "object",
  additionalProperties: false,
  properties: {
    waitForUpdate: {
      type: "boolean",
    },
    force: {
      type: "boolean",
    },
  },
} as const);

export type RefreshDataQuery = Infer<typeof refreshDataQuerySchema>;
