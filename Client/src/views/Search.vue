<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
import DynamicModal from '../components/Modal.vue'
import ResultItem from '../components/ResultItem.vue'
import { client, socket, APIRefresh, defaultQuerySettings, equalObjects } from '../store'

const source = ref({ display: "" })
let prevSource
const destination = ref({ display: "" })
let prevDestination
const sourceCompo = ref()
const destinationCompo = ref()
const searchElem = ref()
const showExtraSettingsElem = ref()
const settings = ref({ ...defaultQuerySettings, transports: { ...defaultQuerySettings.transports } })
let prevSettings
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
const router = useRouter()
let route = useRoute()

onMounted(updateQuery)
onBeforeRouteUpdate((to) => updateQuery(to))

/**
 * @description fetch new results for current query
 */
async function fetchResults(updateQuery = true) {
  if (!source.value.value || !destination.value.value) return status.value.search = false
  if (equalObjects(prevSource, source.value) && equalObjects(prevDestination, destination.value) && equalObjects(prevSettings, settings.value)) return status.value.search = false
  status.value.search = null
  if (updateQuery) queryUpdated()
  try {
    const r = await client.service('itinerary').get('paths', { query: { from: source.value.value, to: destination.value.value, settings: settings.value } })
    if (!r || r.code != 200) throw new Error(`Unable to retrieve itineraries, ${r}.`)
    results.value = r.paths
    if (result.value) result.value = null
    status.value.search = true
  } catch(_) {
    status.value.search = false
  } finally {
    prevSource = JSON.parse(JSON.stringify(source.value))
    prevDestination = JSON.parse(JSON.stringify(destination.value))
    prevSettings = JSON.parse(JSON.stringify(settings.value))
    document.activeElement.blur()
  }
}

let internallyUpdated = false

/**
 * @description Refresh the route according to new query parameters / locations
 */
function queryUpdated() {
  const query = {}
  if (source.value || route.query.from) query.from = source.value.display || route.query.from
  if (destination.value || route.query.to) query.to = destination.value.display || route.query.to
  for (const setting in settings.value) {
    const v = settings.value[setting]
    if (typeof v === 'object') {
      for (const k in v) {
        if (v[k] != defaultQuerySettings[setting][k]) query[`${setting}.${k}`] = v[k]
      }
    } else if (v != defaultQuerySettings[setting]) query[setting] = v
  }
  internallyUpdated = true
  router.push({ query })
}

/**
 * @description Refresh the query parameters / locations according to the current route
 */
async function updateQuery(to = route) {
  if (internallyUpdated) {
    internallyUpdated = false
    return true
  }

  if (to.query.from) await sourceCompo.value.forceInput(to.query.from)
  if (to.query.to) await destinationCompo.value.forceInput(to.query.to)

  for (const setting in defaultQuerySettings) {
    if (typeof defaultQuerySettings[setting] === 'object') {
      for (const k in defaultQuerySettings[setting]) {
        settings.value[setting][k] = defaultQuerySettings[setting][k]
      }
    } else settings.value[setting] = defaultQuerySettings[setting]
  }

  for (const setting in to.query) {
    const v = to.query[setting]
    if (setting.includes('.')) {
        const keys = setting.split('.')
        if (settings.value.hasOwnProperty(keys[0]) && settings.value[keys[0]].hasOwnProperty(keys[1])) settings.value[keys[0]][keys[1]] = v
    } else if (settings.value.hasOwnProperty(setting)) settings.value[setting] = v
  }

  if (to.query.from && to.query.to && !results.value) await fetchResults(false)

  if (to.hash) {
    const r = results.value.find(r => r.id === to.hash.replace('#', ''))
    if (r) result.value = r
    // else -> can't find this result in current computed results. Gonna retrieve it from database, if existing.
  }

  return true
}

async function selectResult(id) {
  const r = results.value.find(r => r.id === id)
  result.value = r
  router.push({ query: route.query, hash: `#${id}` })
}
</script>

<template>
  <div class="h-full">
    <div class="h-full flex flex-col">
      <div
        class="
          w-full
          lg:flex
          relative
          h-fit
          transition-top
          p-2
          pb-1"
        :class="{
          'top-[calc(50%-101px)]': !results,
          'top-0': results ,
        }"
      >
        <div
          class="
            lg:w-2/3
            h-fit
            flex
            justify-center
            lg:justify-end
            my-auto
            lg:mr-1"
        >
          <div
            class="
              flex
              flex-col
              w-[95%]
              xs:w-[80%]
              sm:w-[70%]
              lg:w-1/2"
            :class="status.search === null ? 'cursor-not-allowed opacity-70' : ''"
          >
            <span :disabled="status.search === null">
              <LocationSearch
                ref="sourceCompo"
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
        <div
          class="
            lg:w-1/3
            my-auto
            flex
            justify-center
            lg:inline
            lg:ml-1"
        >
          <div
            class="
              flex
              h-full
              w-[95%]
              xs:w-[80%]
              sm:w-[70%]
              lg:w-1/2"
          >
            <div
              class="
                py-2
                lg:self-center"
            >
              <button
                ref="showExtraSettingsElem"
                class="
                  flex
                  hover:scale-[120%]
                  pulse-scale-focus
                  transition-scale
                  items-center
                  p-2
                  bg-bg-light
                  dark:bg-bg-dark
                  rounded-md
                  justify-self-end"
                :class="{ 'rotate-180': showExtraSettings }"
                @click="showExtraSettings = !showExtraSettings, showExtraSettingsElem.blur()"
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
                  pulse-scale-focus
                  transition-scale
                  items-center
                  p-2
                  mt-2
                  w-fit
                  bg-bg-light
                  dark:bg-bg-dark
                  rounded-md"
                @click="fetchResults(), searchElem.blur()"
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
        v-if="route.hash && result"
        class="
          fade-in
          flex
          px-4
          pt-1
          pb-4"
      >
        <ResultItem
          :title="`Alternative #${results.indexOf(result)+1}`"
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
          grid
          gap-3
          px-4
          pt-2
          pb-4
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4"
        :class="{ 'wait-fade-in': result === undefined, 'fade-in': !route.hash || result === null }"
      >
        <template 
          v-for="(r, i) of results"
          :key="r.id"
        >
          <ResultItem
            :result-id="r.id"
            :title="`Alternative #${i+1}`"
            :total-duration="r.totalDuration"
            :total-distance="r.totalDistance"
            :departure="r.departure"
            :from="r.from"
            :path="r.path"
            class="cursor-pointer"
            @click="selectResult(r.id)"
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
  animation: 300ms fadein;
}

@keyframes wait {
  from { opacity: 0; }
  to   { opacity: 0; }
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
  0%   { transform: scale(1);   }
  50%  { transform: scale(1.2); }
  100% { transform: scale(1);   }
}

.pulse-scale-focus:focus {
  animation: pulseScale 1s;
}
</style>