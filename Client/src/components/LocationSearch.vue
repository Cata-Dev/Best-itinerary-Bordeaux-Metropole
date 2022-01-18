<script setup>
import { ref } from 'vue'
import DatalistInput from './DatalistInput.vue'
import { client } from '../store/'

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

const location = ref({
  datalist: [],
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

  if (location.value.value.display) return updateModelValue(location.value.value)

  const now = Date.now()

  const suggestions = await fetchSuggestions(location.value.input)

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
    <button class="flex mr-1 items-center">
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
  </div>
</template>