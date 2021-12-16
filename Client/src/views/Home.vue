<template>
  <div class="h-full grid auto-rows-auto gap-3">
    <div class="row-start-2 grid grid-cols-3 gap-2">
      <div class="col-start-2 flex flex-row items-center justify-center">
        <div class="flex-col grow">
          <LocationSearch
            ref="sourceElem"
            v-model="source"
            name="source"
            placeholder="Départ"
          />
          <LocationSearch
            ref="destinationElem"
            v-model="destination"
            name="destination"
            placeholder="Arrivée"
            class="mt-2"
          />
        </div>
      </div>
      <div class="flex items-center justify-items-start">
        <ExtraSettings v-model="settings" />
      </div>
    </div>
    <div class="row-start-3 grid grid-cols-3 gap-2" />
  </div>
</template>

<script>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
// import { client } from '../store/'

export default {
    name: 'HomeView',
    components: {
        LocationSearch,
        ExtraSettings,
    },
    setup() {

        const source = ref(null)
        const destination = ref(null)
        const settings = ref(null)

        return {
            source,
            destination,
            settings,
        }
    },
}
</script>

<style>
input {
  @apply bg-transparent
}
input:focus {
  @apply outline-none
}
</style>