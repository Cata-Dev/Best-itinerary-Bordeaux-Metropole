<template>
  <div class="h-full grid auto-rows-auto gap-3">
    <div class="row-start-2 grid grid-cols-3 gap-2">
      <div class="col-start-2 flex flex-row items-center">
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
      <div class="flex">
        <div class="flex h-full">
          <div class="self-center">
            <button
              class="
                flex
                hover:scale-[120%]
                duration-500
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
                class="text-t-light-primary dark:text-t-dark-primary text-2xl"
              />
            </button>
            <button
              class="
                flex
                hover:scale-[120%]
                duration-500
                items-center
                p-2
                mt-2
                w-fit
                bg-bg-light
                dark:bg-bg-dark
                rounded-md"
              @click="shown = !shown"
            >
              <font-awesome-icon
                icon="search-location"
                class="text-t-light-primary dark:text-t-dark-primary text-2xl"
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
    <div class="row-start-3 grid grid-cols-3 gap-2" />
    <DynamicModal
      v-model:shown="modal.shown"
      :title="modal.title"
      :content="modal.content"
      :icon="modal.icon"
      :color="modal.color"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
import DynamicModal from '../components/Modal.vue'
import { socket, APIRefresh } from '../store/'

export default {
    name: 'HomeView',
    components: {
        LocationSearch,
        ExtraSettings,
        DynamicModal,
    },
    setup() {

        const source = ref(null)
        const destination = ref(null)
        const settings = ref(null)
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

        return {
            source,
            destination,
            settings,
            modal,
            showExtraSettings,
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