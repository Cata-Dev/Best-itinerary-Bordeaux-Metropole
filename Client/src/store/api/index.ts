import { router } from "@/router";
import {
  client,
  compareObjectForEach,
  defaultLocation,
  defaultQuerySettings,
  normalizeLocationForQuery,
  parseJSON,
  rebaseObject,
  type Location,
  type Obj,
  type QuerySettings,
  type TransportProvider,
} from "@/store";
import type { Journey as APIJourney, JourneyQuery, PathQuery } from "@bibm/server";
import { ref } from "vue";
import { useRoute, type RouteLocationNormalized, type RouteLocationRaw } from "vue-router";

const actualRoute = ref<RouteLocationNormalized | null>(null);

const source = ref<Location | null>(null);
const destination = ref<Location | null>(null);

const settings = ref<QuerySettings>({
  ...defaultQuerySettings,
  transports: { ...defaultQuerySettings.transports },
});

enum SearchResultStatus {
  NONE,
  LOADING,
  SUCCESS,
  ERROR,
}

const status = ref<{ state: SearchResultStatus; previousSearch: JourneyQuery | string | null }>({
  state: SearchResultStatus.NONE,
  previousSearch: null,
});

type Journey = Omit<APIJourney, "paths"> & { paths: (APIJourney["paths"][number] & { idx: number })[][] };

const result = ref<Journey | null>(null);
const currentJourney = ref<Journey["paths"][number][number] | null>(null);

function normalizeSearchQuery(): JourneyQuery | null {
  if (!source.value) return null;
  const from = normalizeLocationForQuery(source.value);

  if (!destination.value) return null;
  const to = normalizeLocationForQuery(destination.value);

  return {
    from,
    to,
    ...settings.value,
    departureTime: new Date(settings.value.departureTime).toISOString(),
    // From km/h to m/s
    walkSpeed: settings.value.walkSpeed / 3.6,
  } satisfies JourneyQuery;
}

/**
 * Generates an identifier unique for every taken route (not trips), hence identical for two paths with same routes but different trips
 */
function pathSlug(path: APIJourney["paths"][number]) {
  return path.stages.reduce(
    (acc, stage) =>
      acc +
      `${stage.type}-${"type" in stage.details ? `${stage.details.type}-${stage.details.line}` : stage.details.distance}-${stage.to}`,
    "",
  );
}

function treatFetchedResult(fetchedResult: APIJourney): Journey {
  return {
    ...fetchedResult,
    // Groups paths by slugs
    paths: Object.values(
      // Dismiss slugs
      fetchedResult.paths.reduce<Record<string, Journey["paths"][number]>>((acc, path, idx) => {
        const slug = pathSlug(path);
        acc[slug] = [{ ...path, idx }, ...(acc[slug] ?? [])];

        return acc;
      }, {}),
    ),
  };
}

/**
 * @description Fetch new result for current query
 */
async function fetchResult() {
  if (!source.value || !destination.value) return (status.value.state = SearchResultStatus.ERROR);

  status.value.state = SearchResultStatus.LOADING;

  const query = normalizeSearchQuery();

  if (query === null) return (status.value.state = SearchResultStatus.ERROR);

  status.value.previousSearch = query;
  try {
    const r = await client.service("journey").find({ query });
    if (r.code != 200) throw new Error(`Unable to retrieve itineraries, ${JSON.stringify(r)}.`);

    result.value = treatFetchedResult(r);
    currentJourney.value = null;
    // To insert result id (& reset current journey)
    void updateRoute();

    status.value.state = SearchResultStatus.SUCCESS;
  } catch (_) {
    status.value.state = SearchResultStatus.ERROR;
  } finally {
    // Prevent weird mobile behavior
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
  }

  return status.value.state;
}

/**
 * @description Fetch result for old query
 */
async function fetchOldResult(id: string) {
  status.value.state = SearchResultStatus.LOADING;

  status.value.previousSearch = id;
  try {
    const r = await client.service("journey").get(id);
    if (r.code != 200) throw new Error(`Unable to retrieve old result, ${JSON.stringify(r)}.`);

    result.value = treatFetchedResult(r);
    // if (currentJourney.value) currentJourney.value = null;

    status.value.state = SearchResultStatus.SUCCESS;
  } catch (_) {
    status.value.state = SearchResultStatus.ERROR;
  } finally {
    // Prevent weird mobile behavior
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
  }

  return status.value.state;
}

async function fetchFootpaths(
  id: Extract<PathQuery, { id: unknown }>["id"],
  index: Extract<PathQuery, { id: unknown }>["index"],
) {
  try {
    return await client.service("path").find({ query: { for: "journey", id, index, realShape: true } });
  } catch (_) {
    return [];
  }
}

/**
 * @description Apply current route
 */
async function updateQuery(to = useRoute()) {
  if (actualRoute.value?.fullPath === to.fullPath) return;

  actualRoute.value = to;

  // If old result id provided
  if (typeof to.query.rId === "string") {
    if (!result.value) {
      await fetchOldResult(to.query.rId);
    }
  }

  if ((!to.query.from || !to.query.to) && result.value !== null) {
    // Reset search
    status.value.state = SearchResultStatus.NONE;
    result.value = null;
  }

  rebaseObject(settings.value, defaultQuerySettings as unknown as Obj<string | number | boolean>);

  for (const setting in to.query) {
    if (setting.includes(".")) {
      const keys = setting.split(".");

      if (
        keys.length === 2 &&
        keys[0] in settings.value &&
        keys[1] in settings.value[keys[0] as "transports"]
      )
        if (typeof parseJSON(to.query[setting] as string) === "boolean")
          settings.value[keys[0] as "transports"][keys[1] as TransportProvider] = parseJSON(
            to.query[setting] as string,
          );
    } else if (setting in settings.value)
      (settings.value as Record<keyof QuerySettings, unknown>)[setting as keyof QuerySettings] = parseJSON(
        to.query[setting] as string,
      );
  }

  // Force even if empty to clear input
  if (typeof to.query.from === "string" && source.value?.alias !== to.query.from) {
    source.value = { ...defaultLocation, alias: to.query.from };
  }
  if (typeof to.query.to === "string" && destination.value?.alias !== to.query.to)
    destination.value = { ...defaultLocation, alias: to.query.to };

  if (to.hash) {
    if (result.value) {
      const idx = parseInt(to.hash.substring(1));
      const path = result.value.paths.flat().find((path) => path.idx === idx);
      if (path) currentJourney.value = path;
    }
  } else if (currentJourney.value) currentJourney.value = null;
}

/**
 * @description Refresh the route according to current settings & locations
 * @returns A promise that resolves when route as been updated
 */
async function updateRoute() {
  const newRoute = {
    query: {} as Record<string, string>,
    hash: undefined as string | undefined,
  } satisfies RouteLocationRaw;

  if (source.value) newRoute.query.from = source.value.alias;
  if (destination.value) newRoute.query.to = destination.value.alias;

  compareObjectForEach(
    settings.value,
    defaultQuerySettings as unknown as Obj<string | number | boolean>,
    (v1, v2, keys) => {
      if (v1 != v2) newRoute.query[keys.join(".")] = JSON.stringify(v1);
    },
  );

  if (result.value) newRoute.query.rId = result.value.id as string;

  if (currentJourney.value) newRoute.hash = `#${currentJourney.value.idx}`;

  return await router.push(newRoute);
}

export {
  actualRoute,
  currentJourney,
  destination,
  fetchFootpaths,
  fetchResult,
  result,
  SearchResultStatus,
  settings,
  source,
  status,
  updateQuery,
  updateRoute,
};

export type { Journey };
