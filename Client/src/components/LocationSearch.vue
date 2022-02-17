<script setup>
import { ref } from 'vue'
import DatalistInput from './DatalistInput.vue'
import DynamicModal from '../components/Modal.vue'
import { client } from '../store/'
import { Geolocation } from '@capacitor/geolocation';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  placeholder: {
    type: String,
    required: true,
  },
  modelValue: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:modelValue',
])

const modal = ref({
  title: '',
  content: '',
  icon: '',
  color: '',
  shown: false,
})

const location = ref({
  datalist: [],
  geoloc: null,
  input: props.modelValue,
  previousInput: null,
  value: props.modelValue,
  updated: Date.now(),
})

function updateModelValue(v) {
  emit('update:modelValue', v)
}

function parseGeocode(s) {

  switch(s.GEOCODE_type) {
    case 'Addresses':
      return { display: `${s.numero} ${s.rep ? s.rep+' ' : ''}${s.nom_voie} ${s.commune}`, type: "ADRESSE" }

    case 'TBM_Stops':
      return { display: s.libelle, type: s.vehicule }

    case 'SNCF_Stops':
      return { display: s.name, type: "TRAIN" }

    default: return null

  }
}

async function refreshSuggestions() {

  if (location.value.previousInput === location.value.input) return
  if (!location.value.input || location.value.input.length < 5) return location.value.datalist = []

  if (location.value.value.display) updateModelValue(location.value.value)
  if (location.value.input === "Position actuelle") await refreshPosition()

  const now = Date.now()

  const suggestions = await fetchSuggestions(location.value.input)
  if (location.value.geoloc) suggestions.push({ display: "Position actuelle", type: "ADRESSE", value: location.value.geoloc, geoloc: true })

  if (now < location.value.updated) return
  location.value.datalist = suggestions
  location.value.previousInput = location.value.input
  location.value.updated = now

  const validLocation = suggestions.find(l => l.display === location.value.input)
  if (validLocation) updateModelValue(validLocation)

}

async function fetchSuggestions(value) {
  let suggestions
  try {
    suggestions = await client.service('geocode').find({ query: { id: value, max: 25, uniqueVoies: true } })
  } catch(_) {}
  return suggestions && suggestions.length ? suggestions.map(s => ({ value: s.coords, ...parseGeocode(s) })) : []
}

async function refreshPosition() {
  if (!await fetchPosition()) return

  const existing = location.value.datalist.find(l => l.geoloc)
  if (existing) existing.value = location.value.geoloc
  else location.value.datalist.push({ display: "Position actuelle", type: "ADRESSE", value: location.value.geoloc, geoloc: true })
  input.value.forceInput("Position actuelle")
  return true
}

async function fetchPosition() {
  try {
    const pos = await Geolocation.getCurrentPosition();
    location.value.geoloc = [
      pos.coords.latitude,
      pos.coords.longitude,
    ];
    return true
  } catch (e) {
    switch (e.code) {
      case 1:
        modal.value.content = "Impossible de récupérer votre position.\nMerci d'autoriser l'accès."
        break
      default:
        modal.value.content = "Impossible de récupérer votre position."
    }
    modal.value.title = "Erreur"
    modal.value.icon = "exclamation-triangle"
    modal.value.color = "alert"
    modal.value.shown = true
    return false
  }
}

const input = ref()

function focus() {
  input.value.focus()
}

async function forceInput(v) {
  location.value.previousInput = location.value.input,
  input.value.forceInput(v)
  await refreshSuggestions()
}

defineExpose({
  focus,
  forceInput,
})
</script>

<template>
  <div
    class="
      flex
      w-full
      items-stretch
      relative
      px-3
      py-2
      bg-bg-light
      dark:bg-bg-dark
      rounded-full
      shadow-xl"
  >
    <button
      class="flex mr-1 items-center"
      @click="refreshPosition()"
    >
      <font-awesome-icon
        icon="crosshairs"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl"
      />
    </button>
    <DatalistInput
      ref="input"
      v-model="location.value"
      :placeholder="placeholder"
      :datalist="location.datalist"
      class="
        px-2
        flex-grow
        text-text-light-primary
        dark:text-text-dark-primary
        placeholder-text-light-faded
        dark:placeholder-text-dark-faded"
      @input="location.input = $event, refreshSuggestions()"
    />
    <span class="flex mr-1 items-center">
      <font-awesome-icon
        :icon="name == 'destination' ? 'flag' : 'map-pin'"
        class="
          text-text-light-primary
          dark:text-text-dark-primary
          text-2xl
          ml-1"
      />
    </span>
    <DynamicModal
      v-model:shown="modal.shown"
      :title="modal.title"
      :content="modal.content"
      :icon="modal.icon"
      :color="modal.color"
    />
  </div>
</template>