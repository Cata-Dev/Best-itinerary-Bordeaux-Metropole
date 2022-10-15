import { resolve } from "@feathersjs/schema";
import type { HookContext } from "../../declarations";

import type { GeocodeData, GeocodePatch, GeocodeResult, GeocodeQuery } from "./geocode.schema";
import {
  geocodeDataSchema,
  geocodePatchSchema,
  geocodeResultSchema,
  geocodeQuerySchema,
} from "./geocode.schema";

// Resolver for the basic data model (e.g. creating new entries)
export const geocodeDataResolver = resolve<GeocodeData, HookContext>({
  schema: geocodeDataSchema,
  validate: "before",
  properties: {},
});

// Resolver for making partial updates
export const geocodePatchResolver = resolve<GeocodePatch, HookContext>({
  schema: geocodePatchSchema,
  validate: "before",
  properties: {},
});

// Resolver for the data that is being returned
export const geocodeResultResolver = resolve<GeocodeResult, HookContext>({
  schema: geocodeResultSchema,
  validate: false,
  properties: {},
});

// Resolver for query properties
export const geocodeQueryResolver = resolve<GeocodeQuery, HookContext>({
  schema: geocodeQuerySchema,
  validate: "before",
  properties: {},
});

// Export all resolvers in a format that can be used with the resolveAll hook
export const geocodeResolvers = {
  result: geocodeResultResolver,
  data: {
    create: geocodeDataResolver,
    update: geocodeDataResolver,
    patch: geocodePatchResolver,
  },
  query: geocodeQueryResolver,
};
