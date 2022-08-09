import { resolve } from "@feathersjs/schema";
import type { HookContext } from "../../declarations";

import type { ItineraryData, ItineraryPatch, ItineraryResult, ItineraryQuery } from "./itinerary.schema";
import {
  itineraryDataSchema,
  itineraryPatchSchema,
  itineraryResultSchema,
  itineraryQuerySchema,
} from "./itinerary.schema";

// Resolver for the basic data model (e.g. creating new entries)
export const itineraryDataResolver = resolve<ItineraryData, HookContext>({
  schema: itineraryDataSchema,
  validate: "before",
  properties: {},
});

// Resolver for making partial updates
export const itineraryPatchResolver = resolve<ItineraryPatch, HookContext>({
  schema: itineraryPatchSchema,
  validate: "before",
  properties: {},
});

// Resolver for the data that is being returned
export const itineraryResultResolver = resolve<ItineraryResult, HookContext>({
  schema: itineraryResultSchema,
  validate: false,
  properties: {},
});

// Resolver for query properties
export const itineraryQueryResolver = resolve<ItineraryQuery, HookContext>({
  schema: itineraryQuerySchema,
  validate: "before",
  properties: {},
});

// Export all resolvers in a format that can be used with the resolveAll hook
export const itineraryResolvers = {
  result: itineraryResultResolver,
  data: {
    create: itineraryDataResolver,
    update: itineraryDataResolver,
    patch: itineraryPatchResolver,
  },
  query: itineraryQueryResolver,
};
