<script setup>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
import DynamicModal from '../components/Modal.vue'
import ResultItem from '../components/ResultItem.vue'
import { client, socket, APIRefresh } from '../store/'

const source = ref({ display: "" })
const destination = ref({ display: "" })
const destinationCompo = ref()
const searchElem = ref()
const settings = ref({})
const modal = ref({
  title: '',
  content: '',
  icon: '',
  color: '',
  shown: false,
})

socket.io.on('error', () => {
  modal.value.title = "Erreur"
  modal.value.content = "Impossible de se connecter à l'API."
  modal.value.icon = "exclamation-triangle"
  modal.value.color = "alert"
  modal.value.shown = true
  APIRefresh.reject({ code: 504 }) //generate a fake answer to ensure failure
})

const showExtraSettings = ref(false)

const status = ref({
  source: undefined,
  destination: undefined,
  ExtraSettings: undefined,
  search: undefined,
})
const results = ref()
const result = ref()

async function fetchResults() {
  if (!source.value.value || !destination.value.value) return status.value.search = false
  status.value.search = null
  try {
    const r = await client.service('itinerary').get('paths', { query: { from: source.value.value, to: destination.value.value, settings: settings.value } })
    if (!r || r.code != 200) throw new Error(`Unable to retrieve itineraries, ${r}.`)
    results.value = r.paths
    result.value = null
    status.value.search = true
  } catch(_) {
    status.value.search = false
  } finally {
    document.activeElement.blur()
  }
}
</script>

<template>
  <div class="h-full">
    <div class="h-full flex flex-col">
      <div
        class="
          w-full
          flex
          relative
          h-fit
          transition-top
          p-2"
        :class="{
          'top-[calc(50%-101px)]': !results,
          'top-0': results ,
        }"
      >
        <div
          class="
            w-2/3
            h-fit
            flex
            justify-end
            my-auto
            mr-1"
        >
          <div
            class="
              flex
              flex-col
              w-1/2"
            :class="status.search === null ? 'cursor-not-allowed opacity-70' : ''"
          >
            <span :disabled="status.search === null">
              <LocationSearch
                v-model="source"
                name="source"
                placeholder="Départ"
                @update:model-value="destinationCompo.focus()"
              />
            </span>
            <span :disabled="status.search === null">
              <LocationSearch
                ref="destinationCompo"
                v-model="destination"
                name="destination"
                placeholder="Arrivée"
                class="mt-2"
                @update:model-value="searchElem.focus()"
              />
            </span>
          </div>
        </div>
        <div class="w-1/3 my-auto inline ml-1">
          <div class="flex h-full">
            <div class="self-center">
              <button
                class="
                  flex
                  hover:scale-[120%]
                  focus-visible:scale-[120%]
                  transition-scale
                  items-center
                  p-2
                  bg-bg-light
                  dark:bg-bg-dark
                  rounded-md
                  justify-self-end"
                :class="{ 'rotate-180': showExtraSettings }"
                @click="showExtraSettings = !showExtraSettings"
              >
                <font-awesome-icon
                  icon="sliders-h"
                  class="text-text-light-primary dark:text-text-dark-primary text-2xl"
                />
              </button>
              <button
                ref="searchElem"
                class="
                  flex
                  hover:scale-[120%]
                  focus-visible:scale-[120%]
                  transition-scale
                  items-center
                  p-2
                  mt-2
                  w-fit
                  bg-bg-light
                  dark:bg-bg-dark
                  rounded-md"
                @click="fetchResults()"
              >
                <font-awesome-icon
                  icon="search-location"
                  class="text-2xl transition-colors duration-200"
                  :class="{
                    'text-success-t': status.search === true,
                    'text-info-t': status.search === null, 
                    'text-alert-t': status.search === false,
                    'text-text-light-primary': status.search === undefined,
                    'dark:text-text-dark-primary text-2xl': status.search === undefined }"
                />
              </button>
            </div>
            <ExtraSettings
              v-model="settings"
              :shown="showExtraSettings"
              class=""
            />
          </div>
        </div>
      </div>
      <div
        v-if="result"
        class="
          fade-in
          flex
          px-4
          pt-2
          pb-4"
      >
        <ResultItem
          :title="`Alternative #${result.id}`"
          :total-duration="result.totalDuration"
          :total-distance="result.totalDistance"
          :departure="result.departure"
          :from="result.from"
          :path="result.path"
          :expanded="true"
          class="mx-auto"
        />
      </div>
      <div
        v-else-if="results"
        class="
          wait-fade-in
          grid
          gap-3
          px-4
          pt-2
          pb-4
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4"
      >
        <template 
          v-for="r of results"
          :key="r.id"
        >
          <ResultItem
            :title="`Alternative #${r.id}`"
            :total-duration="r.totalDuration"
            :total-distance="r.totalDistance"
            :departure="r.departure"
            :from="r.from"
            :path="r.path"
            class="cursor-pointer"
            @click="result = r"
          />
        </template>
      </div>
      <div
        v-else
        class="grid gap-2 row-start-3"
      />
    </div>
    <DynamicModal
      v-model:shown="modal.shown"
      :title="modal.title"
      :content="modal.content"
      :icon="modal.icon"
      :color="modal.color"
    />
  </div>
</template>

<style>
input {
  @apply bg-transparent
}

input:focus, button:focus {
  @apply outline-0
}

div[disabled="true"], span[disabled="true"] {
  pointer-events: none;
}

@keyframes fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.fade-in {
  animation: fadein 300ms;
}

@keyframes wait {
  from { opacity: 0; }
  to   { opacity: 0; }
}

.wait-fade-in {
  animation: wait 500ms, 300ms fadein 500ms;
}

.transition-scale {
  transition-property: transform;
  transition-duration: 300ms;
}

.transition-top {
  transition-property: top;
  transition-duration: 750ms;
}
</style>