<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute, onBeforeRouteUpdate, type RouteLocationNormalized } from "vue-router";
import LocationSearch, { type ParsedGeocodeLocation } from "@/components/LocationSearch.vue";
import ExtraSettings from "@/components/ExtraSettings.vue";
import BadeModal from "@/components/BaseModal.vue";
import ResultItem from "@/components/ResultItem.vue";
import {
  client,
  APIRefresh,
  defaultQuerySettings,
  equalObjects,
  rebaseObject,
  compareObjectForEach,
  type TransportProvider,
  parseJSON,
  type DefaultLocation,
  defaultLocation,
  type colorPalette,
  type colorComm,
} from "@/store";
import type { QuerySettings, Obj } from "@/store";
import type { Itinerary } from "server";

type Location = ParsedGeocodeLocation | DefaultLocation;

const source = ref<Location>(defaultLocation);
const destination = ref<Location>(defaultLocation);

const sourceCompo = ref<InstanceType<typeof LocationSearch> | null>(null);
const destinationCompo = ref<InstanceType<typeof LocationSearch> | null>(null);
const settingsCompo = ref<InstanceType<typeof ExtraSettings> | null>(null);
const modalCompo = ref<InstanceType<typeof BadeModal> | null>(null);

const searchElem = ref<HTMLButtonElement | null>(null);
const showSettingsButton = ref<HTMLButtonElement | null>(null);
const settings = ref<QuerySettings>({
  ...defaultQuerySettings,
  transports: { ...defaultQuerySettings.transports },
});

interface CustomModal {
  title: string;
  content: string;
  icon: string;
  colors: `${string}-${colorPalette<colorComm>}`[];
}
const modal = ref<CustomModal>({
  title: "",
  content: "",
  icon: "",
  colors: [],
});

if (client.io?.io)
  client.io.io?.on("error", () => {
    modal.value.title = "Erreur";
    modal.value.content = "Impossible de se connecter à l'API.";
    modal.value.icon = "exclamation-triangle";
    modal.value.colors = ["bg-alert-bg", "border-alert-t", "text-alert-t"];
    modalCompo.value?.show(true);
    APIRefresh.reject({ code: 504 }); //generate a fake answer to ensure failure
  });

enum StatusSearchResult {
  NONE,
  LOADING,
  SUCCESS,
  ERROR,
}

interface Status {
  search: StatusSearchResult;
}

const status = ref<Status>({
  search: StatusSearchResult.NONE,
});
const results = ref<Itinerary["paths"] | StatusSearchResult>(StatusSearchResult.NONE);
const result = ref<Itinerary["paths"][number] | null>();
const router = useRouter();
const route = useRoute();
// Because `route` from `useroute()` isn't updated before validating navigation, e.g. before validating all navigation guards, we need to store the upcoming route
const actualRoute = ref<RouteLocationNormalized | null>(null);

onMounted(updateQuery);
onBeforeRouteUpdate((to) => updateQuery(to));

/**
 * @description fetch new results for current query
 */
async function fetchResults() {
  if (!source.value.display.length || !destination.value.display.length)
    return (status.value.search = StatusSearchResult.ERROR);

  status.value.search = StatusSearchResult.LOADING;

  try {
    const r = await client.service("itinerary").get("paths", {
      query: {
        from: source.value.display,
        to: destination.value.display,
        ...settings.value,
      },
    });
    if (r.code != 200) throw new Error(`Unable to retrieve itineraries, ${r}.`);

    results.value = r.paths;
    if (result.value) result.value = null;

    status.value.search = StatusSearchResult.SUCCESS;
  } catch (_) {
    status.value.search = StatusSearchResult.ERROR;
  } finally {
    //Prevent weird mobile behavior
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
  }
}

/**
 * @description Refresh the route according to new settings & locations
 * @returns A promise that resolves when route as been updated
 */
async function updateRoute() {
  const query: Record<string, string> = {};

  if (source.value.display.length) query.from = source.value.display;
  if (destination.value.display.length) query.to = destination.value.display;

  compareObjectForEach(
    settings.value,
    defaultQuerySettings as unknown as Obj<string | number | boolean>,
    (v1, v2, keys) => {
      if (v1 != v2) query[keys.join(".")] = JSON.stringify(v1);
    },
  );

  return await router.push({ query });
}

/**
 * @description Refresh settings / locations according to the current route
 */
async function updateQuery(to = route) {
  if (equalObjects(actualRoute.value, to)) return (actualRoute.value = to);
  actualRoute.value = to;

  if ((!to.query.from || !to.query.to) && results.value instanceof Array) {
    // Reset search
    results.value = StatusSearchResult.NONE;
    status.value.search = StatusSearchResult.NONE;
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

  const updates: Promise<unknown>[] = [];
  // Force even if empty to clear input
  if (source.value.display !== to.query.from && sourceCompo.value)
    updates.push(sourceCompo.value?.forceInput((to.query.from as string | undefined) ?? ""));
  if (destination.value.display !== to.query.to && destinationCompo.value)
    updates.push(destinationCompo.value?.forceInput((to.query.to as string | undefined) ?? ""));
  await Promise.all(updates);

  if (to.query.from && to.query.to && !(results.value instanceof Array)) await fetchResults(); //Update results if detecting a new query, but don't override existing results ?

  if (to.hash) {
    if (results.value instanceof Array) {
      const r = results.value.find((r) => r.id === to.hash.replace("#", ""));
      if (r) result.value = r;
      // else -> can't find this result in current computed results. Gonna retrieve it from database, if existing.
    }
  }

  return true;
}

async function selectResult(id: string) {
  if (!(results.value instanceof Array)) return;

  const r = results.value.find((r) => r.id === id);
  result.value = r;

  router.push({ query: route.query, hash: `#${id}` });
}
</script>

<template>
  <div class="h-full">
    <div class="h-full flex flex-col">
      <div
        class="w-full flex relative h-fit transition-top p-2 pb-1"
        :class="{
          'top-[calc(50%-101px)]': results === StatusSearchResult.NONE,
          'top-0': results != StatusSearchResult.NONE,
        }"
      >
        <div class="w-2/3 h-fit flex justify-end my-auto mr-1">
          <div
            class="flex flex-col w-[95%] xs:w-[80%] sm:w-[70%] lg:w-1/2"
            :loading="status.search === StatusSearchResult.LOADING"
          >
            <span>
              <LocationSearch
                ref="sourceCompo"
                v-model="source"
                name="source"
                placeholder="Départ"
                @update:model-value="
                  if ((actualRoute?.query.from || '') !== source.display) updateRoute();
                  if (source.display.length) {
                    if (!destination.display.length) destinationCompo?.focus();
                    else searchElem?.focus();
                  }
                "
              />
            </span>
            <span>
              <LocationSearch
                ref="destinationCompo"
                v-model="destination"
                name="destination"
                placeholder="Arrivée"
                class="mt-2"
                @update:model-value="
                  if ((actualRoute?.query.to || '') !== destination.display) updateRoute();
                  if (destination.display.length) {
                    if (!source.display.length) sourceCompo?.focus();
                    else searchElem?.focus();
                  }
                "
              />
            </span>
          </div>
        </div>
        <div class="w-1/3 my-auto justify-center inline ml-1">
          <div class="flex h-full xs:w-[80%] sm:w-[70%] w-1/2">
            <div class="py-2 self-center">
              <button
                ref="showSettingsButton"
                class="flex hover:scale-[120%] pulse-scale-focus transition-scale items-center p-2 bg-bg-light dark:bg-bg-dark rounded-md justify-self-end"
                :class="{ 'rotate-180': settingsCompo?.shown }"
                @click="settingsCompo?.show(), showSettingsButton?.blur()"
              >
                <font-awesome-icon
                  icon="sliders-h"
                  class="text-text-light-primary dark:text-text-dark-primary text-2xl"
                />
              </button>
              <button
                ref="searchElem"
                class="flex hover:scale-[120%] pulse-scale-focus transition-scale items-center p-2 mt-2 w-fit bg-bg-light dark:bg-bg-dark rounded-md"
                @click="fetchResults(), searchElem?.blur()"
              >
                <font-awesome-icon
                  icon="search-location"
                  class="text-2xl transition-colors duration-200"
                  :class="{
                    'text-success-t': status.search === StatusSearchResult.SUCCESS,
                    'text-info-t': status.search === StatusSearchResult.LOADING,
                    'text-alert-t': status.search === StatusSearchResult.ERROR,
                    'text-text-light-primary dark:text-text-dark-primary':
                      status.search === StatusSearchResult.NONE,
                  }"
                />
              </button>
            </div>
            <ExtraSettings
              ref="settingsCompo"
              v-model="settings"
              :init-shown="false"
              @update:model-value="updateRoute()"
            />
          </div>
        </div>
      </div>
      <div v-if="result && route.hash" class="fade-in flex px-4 pt-1 pb-4">
        <ResultItem
          :title="`Alternative #${(results as any[]).indexOf(result) + 1}`"
          :total-duration="result.totalDuration"
          :total-distance="result.totalDistance"
          :departure="result.departure"
          :from="result.from"
          :path="result.stages"
          :expanded="true"
          class="mx-auto"
        />
      </div>
      <div
        v-else-if="results && typeof results === 'object'"
        class="grid gap-3 px-4 pt-2 pb-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        :class="{
          'wait-fade-in': result === undefined,
          'fade-in': !route.hash || result === null,
        }"
      >
        <template v-for="(r, i) of results" :key="r.id">
          <ResultItem
            :result-id="r.id"
            :title="`Alternative #${i + 1}`"
            :total-duration="r.totalDuration"
            :total-distance="r.totalDistance"
            :departure="r.departure"
            :from="r.from"
            :path="r.stages"
            class="cursor-pointer"
            @click="selectResult(r.id)"
          />
        </template>
      </div>
      <div v-else class="grid gap-2 row-start-3" />
    </div>
    <BadeModal ref="modalCompo" :main-classes="modal.colors">
      <template #title>
        <h1 class="text-2xl text-center">
          <font-awesome-icon :icon="modal.icon || 'spinner'" class="mr-1" />
          {{ modal.title }}
        </h1>
      </template>
      <template #content>
        {{ modal.content }}
      </template>
    </BadeModal>
  </div>
</template>

<style>
input {
  @apply bg-transparent;
}

input:focus,
button:focus {
  @apply outline-0;
}

.loading-wrapper {
  @apply opacity-70 !important;
  @apply cursor-wait !important;
}

.loading {
  pointer-events: none !important;
}

[loading="true"] {
  @apply loading-wrapper;
}

[loading="true"] * {
  @apply loading;
}

@keyframes fadein {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.fade-in {
  animation: 300ms fadein;
}

@keyframes wait {
  from {
    opacity: 0;
  }

  to {
    opacity: 0;
  }
}

.wait-fade-in {
  animation: wait 500ms, 300ms fadein 500ms;
}

.transition-scale {
  transition: transform 300ms;
}

.transition-top {
  transition: top 750ms;
}

@keyframes pulseScale {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.2);
  }

  100% {
    transform: scale(1);
  }
}

.pulse-scale-focus:focus {
  animation: pulseScale 1s;
}
</style>
