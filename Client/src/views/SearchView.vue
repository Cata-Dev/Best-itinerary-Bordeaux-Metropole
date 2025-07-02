<script setup lang="ts">
import BaseModal from "@/components/BaseModal.vue";
import ExtraSettings from "@/components/ExtraSettings.vue";
import LocationSearch from "@/components/LocationSearch.vue";
import ResultItem from "@/components/ResultItem.vue";
import { APIRefresh, client, type colorComm, type colorPalette } from "@/store";
import {
  actualRoute,
  currentJourney,
  destination,
  fetchResult,
  result,
  SearchResultStatus,
  settings,
  source,
  status,
  updateQuery,
  updateRoute,
} from "@/store/api";
import type { Journey } from "@bibm/server";
import { onMounted, ref } from "vue";
import { onBeforeRouteUpdate } from "vue-router";

const sourceCompo = ref<InstanceType<typeof LocationSearch> | null>(null);
const destinationCompo = ref<InstanceType<typeof LocationSearch> | null>(null);
const settingsCompo = ref<InstanceType<typeof ExtraSettings> | null>(null);
const modalCompo = ref<InstanceType<typeof BaseModal> | null>(null);

const searchElem = ref<HTMLButtonElement | null>(null);
const showSettingsButton = ref<HTMLButtonElement | null>(null);

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

onMounted(updateQuery);
onBeforeRouteUpdate(updateQuery);

async function selectResult(idx: number) {
  if (!result.value) return;

  currentJourney.value = result.value.paths[idx];

  updateRoute();
}
</script>

<template>
  <div class="h-full">
    <div class="h-full flex flex-col">
      <div
        class="w-full flex justify-center relative h-fit transition-top p-2 pb-1"
        :class="{
          'top-[calc(50%-101px)]': !result,
          'top-0': !result,
        }"
      >
        <div class="xs:w-2/3 w-auto h-fit flex justify-end my-auto mr-1">
          <div
            class="flex flex-col w-[95%] xs:w-[80%] sm:w-[70%] lg:w-1/2"
            :loading="status.state === SearchResultStatus.LOADING"
          >
            <span>
              <LocationSearch
                ref="sourceCompo"
                v-model="source"
                name="source"
                placeholder="Départ"
                @update:model-value="
                  if (source) {
                    if (actualRoute?.query.from !== source.alias) updateRoute();
                    if (!destination) destinationCompo?.focus();
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
                  if (destination) {
                    if (actualRoute?.query.to !== destination.alias) updateRoute();
                    if (!source) sourceCompo?.focus();
                    else searchElem?.focus();
                  }
                "
              />
            </span>
          </div>
        </div>
        <div class="xs:w-1/3 w-auto my-auto justify-center inline ml-1">
          <div class="flex h-full xs:w-[80%] sm:w-[70%] w-1/2">
            <div class="py-2 self-center">
              <button
                ref="showSettingsButton"
                class="flex hover:scale-[120%] pulse-scale-focus transition-scale items-center p-2 bg-bg-light dark:bg-bg-dark rounded-md justify-self-end"
                :class="{ 'rotate-180': settingsCompo?.shown }"
                @click="(settingsCompo?.show(), showSettingsButton?.blur())"
              >
                <font-awesome-icon
                  icon="sliders-h"
                  class="text-text-light-primary dark:text-text-dark-primary text-2xl"
                />
              </button>
              <button
                ref="searchElem"
                class="flex hover:scale-[120%] pulse-scale-focus transition-scale items-center p-2 mt-2 w-fit bg-bg-light dark:bg-bg-dark rounded-md"
                @click="(fetchResult(), searchElem?.blur())"
              >
                <font-awesome-icon
                  icon="search-location"
                  class="text-2xl transition-colors duration-200"
                  :class="{
                    'text-success-t': status.state === SearchResultStatus.SUCCESS,
                    'text-info-t': status.state === SearchResultStatus.LOADING,
                    'text-alert-t': status.state === SearchResultStatus.ERROR,
                    'text-text-light-primary dark:text-text-dark-primary':
                      status.state === SearchResultStatus.NONE,
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
      <div v-if="currentJourney" class="fade-in flex px-4 pt-1 pb-4">
        <ResultItem
          :title="`Alternative #${(result as Journey).paths.indexOf(currentJourney) + 1}`"
          :from="(result as Journey).from"
          :path="currentJourney.stages"
          :criteria="currentJourney.criteria"
          :expanded="true"
          class="mx-auto"
        />
      </div>
      <div
        v-else-if="result && typeof result === 'object'"
        class="grid gap-3 px-4 pt-2 pb-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        :class="{
          'wait-fade-in': currentJourney === undefined,
          'fade-in': currentJourney === null,
        }"
      >
        <template v-for="(path, i) of result.paths" :key="i">
          <ResultItem
            :title="`Alternative #${i + 1}`"
            :from="result.from"
            :path="path.stages"
            :criteria="path.criteria"
            class="cursor-pointer"
            @click="selectResult(i)"
          />
        </template>
      </div>
      <div v-else class="grid gap-2 row-start-3" />
    </div>
    <BaseModal ref="modalCompo" :main-classes="modal.colors">
      <template #title>
        <h1 class="text-2xl text-center">
          <font-awesome-icon :icon="modal.icon || 'spinner'" class="mr-1" />
          {{ modal.title }}
        </h1>
      </template>
      <template #content>
        {{ modal.content }}
      </template>
    </BaseModal>
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
  animation:
    wait 500ms,
    300ms fadein 500ms;
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
