import { resolve } from "@feathersjs/schema";
import { Type, getDataValidator, getValidator } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";

// Main data model schema
export const refreshDataSchema = Type.Object(
  {
    actualized: Type.Union([Type.Number(), Type.Boolean(), Type.Null()]),
    lastActualization: Type.Integer(),
  },
  { $id: "RefreshData", additionalProperties: false },
);

export type RefreshData = Static<typeof refreshDataSchema>;
export const refreshDataResolver = resolve<RefreshData, HookContext>({});

export const refreshDataExternalResolver = resolve<RefreshData, HookContext>({});

// Schema for creating new entries
export const refreshDataDataSchema = Type.Object({}, { $id: "RefreshDataData" });
export type RefreshDataData = Static<typeof refreshDataDataSchema>;
export const refreshDataDataValidator = getDataValidator(refreshDataDataSchema, dataValidator);
export const refreshDataDataResolver = resolve<RefreshData, HookContext>({});

// Schema for updating existing entries
export const refreshDataPatchSchema = Type.Partial(refreshDataDataSchema, {
  $id: "RefreshDataPatch",
});
export type RefreshDataPatch = Static<typeof refreshDataPatchSchema>;
export const refreshDataPatchValidator = getDataValidator(refreshDataPatchSchema, dataValidator);
export const refreshDataPatchResolver = resolve<RefreshData, HookContext>({});

// Schema for allowed query properties
export const refreshDataQueryProperties = Type.Object({}, { additionalProperties: false });
export const refreshDataQuerySchema = Type.Object(
  {
    waitForUpdate: Type.Boolean(),
    force: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type RefreshDataQuery = Static<typeof refreshDataQuerySchema>;
export const refreshDataQueryValidator = getValidator(refreshDataQuerySchema, queryValidator);
export const refreshDataQueryResolver = resolve<RefreshDataQuery, HookContext>({});
