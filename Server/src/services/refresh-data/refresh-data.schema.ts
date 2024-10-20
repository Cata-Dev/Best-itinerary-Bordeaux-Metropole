import { resolve } from "@feathersjs/schema";
import { Type, getValidator } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import type { HookContext } from "../../declarations";
import { dataValidator, queryValidator } from "../../validators";
import type { RefreshDataService } from "./refresh-data.class";

// Main data model schema
export const refreshDataSchema = Type.Object(
  {
    actualized: Type.Union([Type.Number(), Type.Boolean(), Type.Null()]),
    lastActualization: Type.Integer(),
  },
  { $id: "RefreshData", additionalProperties: false },
);

export type RefreshData = Static<typeof refreshDataSchema>;
export const refreshDataResolver = resolve<RefreshData, HookContext<RefreshDataService>>({});

export const refreshDataExternalResolver = resolve<RefreshData, HookContext<RefreshDataService>>({});

// Schema for creating new entries
export const refreshDataDataSchema = Type.Object({}, { $id: "RefreshDataData" });
export type RefreshDataData = Static<typeof refreshDataDataSchema>;
export const refreshDataDataValidator = getValidator(refreshDataDataSchema, dataValidator);
export const refreshDataDataResolver = resolve<RefreshData, HookContext<RefreshDataService>>({});

// Schema for updating existing entries
export const refreshDataPatchSchema = Type.Partial(refreshDataDataSchema, {
  $id: "RefreshDataPatch",
});
export type RefreshDataPatch = Static<typeof refreshDataPatchSchema>;
export const refreshDataPatchValidator = getValidator(refreshDataPatchSchema, dataValidator);
export const refreshDataPatchResolver = resolve<RefreshData, HookContext<RefreshDataService>>({});

// Schema for allowed query properties
// Unused here, custom service without storage
export const refreshDataQueryProperties = Type.Object({});
export const refreshDataQuerySchema = Type.Object(
  {
    waitForUpdate: Type.Optional(Type.Boolean()),
    force: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type RefreshDataQuery = Static<typeof refreshDataQuerySchema>;
export const refreshDataQueryValidator = getValidator(refreshDataQuerySchema, queryValidator);
export const refreshDataQueryResolver = resolve<RefreshDataQuery, HookContext<RefreshDataService>>({});
