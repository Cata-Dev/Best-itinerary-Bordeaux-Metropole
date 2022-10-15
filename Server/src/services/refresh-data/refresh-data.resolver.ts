import { resolve } from "@feathersjs/schema";
import type { HookContext } from "../../declarations";

import type {
  RefreshDataData,
  RefreshDataPatch,
  RefreshDataResult,
  RefreshDataQuery,
} from "./refresh-data.schema";
import {
  refreshDataDataSchema,
  refreshDataPatchSchema,
  refreshDataResultSchema,
  refreshDataQuerySchema,
} from "./refresh-data.schema";

// Resolver for the basic data model (e.g. creating new entries)
export const refreshDataDataResolver = resolve<RefreshDataData, HookContext>({
  schema: refreshDataDataSchema,
  validate: "before",
  properties: {},
});

// Resolver for making partial updates
export const refreshDataPatchResolver = resolve<RefreshDataPatch, HookContext>({
  schema: refreshDataPatchSchema,
  validate: "before",
  properties: {},
});

// Resolver for the data that is being returned
export const refreshDataResultResolver = resolve<RefreshDataResult, HookContext>({
  schema: refreshDataResultSchema,
  validate: false,
  properties: {},
});

// Resolver for query properties
export const refreshDataQueryResolver = resolve<RefreshDataQuery, HookContext>({
  schema: refreshDataQuerySchema,
  validate: "before",
  properties: {},
});

// Export all resolvers in a format that can be used with the resolveAll hook
export const refreshDataResolvers = {
  result: refreshDataResultResolver,
  data: {
    create: refreshDataDataResolver,
    update: refreshDataDataResolver,
    patch: refreshDataPatchResolver,
  },
  query: refreshDataQueryResolver,
};
