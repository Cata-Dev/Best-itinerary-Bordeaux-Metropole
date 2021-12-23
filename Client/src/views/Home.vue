<script setup>
import { ref } from 'vue'
import LocationSearch from '../components/LocationSearch.vue'
import ExtraSettings from '../components/ExtraSettings.vue'
import DynamicModal from '../components/Modal.vue'
import { socket, APIRefresh } from '../store/'

const source = ref()
const destination = ref()
const destinationCompo = ref()
const searchElem = ref()
const settings = ref()
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
</script>

<template>
  <div class="h-full grid auto-rows-auto gap-3">
    <div class="row-start-2 grid grid-cols-3 gap-2">
      <div class="col-start-2 flex flex-row items-center">
        <div class="flex-col grow">
          <LocationSearch
            v-model="source"
            name="source"
            placeholder="Départ"
            @update:model-value="destinationCompo.focus()"
          />
          <LocationSearch
            ref="destinationCompo"
            v-model="destination"
            name="destination"
            placeholder="Arrivée"
            class="mt-2"
            @update:model-value="searchElem.focus()"
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
              ref="searchElem"
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
              @click="true"
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

<style>
input {
  @apply bg-transparent
}
input:focus {
  @apply outline-none
}
</style>