<script setup>
import { ref } from 'vue'
import { client } from '../store/'

defineProps({
    name: {
        type: String,
        default: 'source',
        requierd: true,
    },
    placeholder: {
        type: String,
        default: 'Départ',
        requierd: true,
    },
    modelValue: {
        type: Object,
        default() {
          return {}
        },
        requierd: true,
    },
})

const emit = defineEmits([
    'update:modelValue',
])

const location = ref({
    datalist: [],
    input: '',
    previousInput: null,
    updated: Date.now(),
})

function updateModelValue(v) {
    emit('update:modelValue', v)
}

function parseGeocode(s) {

    switch(s.GEOCODE_type) {
        case 'Addresses':
            return { display: `${s.numero} ${s.rep ? s.rep+' ' : ''}${s.nom_voie} ${s.commune}`, type: "Adresse" }

        case 'TBM_Stops':
            return { display: s.libelle, type: s.vehicule }

        case 'SNCF_Stops':
            return { display: s.name, type: "Train" }

        default: return null

    }
}

async function refreshSuggestions() {

    if (location.value.previousInput === location.value.input) return
    if (location.value.input.length < 5) return location.value.datalist = []
    const validLocation = location.value.datalist.find(l => l.display == location.value.input)
    if (validLocation) {
        updateModelValue(validLocation)
        return
    }
    const now = Date.now()
    let suggestions
    try {
        suggestions = await client.service('geocode').find({ query: { id: location.value.input, max: 25, uniqueVoies: true } })
    // eslint-disable-next-line no-empty
    } catch(_) {}
    if (now < location.value.updated) return
    location.value.datalist = suggestions && suggestions.length ? suggestions.map(s => ({ value: s.coords, ...parseGeocode(s) })) : []
    location.value.previousInput = location.value.input
    location.value.updated = now

}

const input = ref()

function focus() {
  input.value.focus()
}

defineExpose({
  focus,
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
      rounded-full"
  >
    <button class="flex mr-1 items-center">
      <font-awesome-icon
        icon="crosshairs"
        class="text-t-light-primary dark:text-t-dark-primary text-2xl"
      />
    </button>
    <input
      ref="input"
      v-model="location.input"
      type="text"
      :list="name"
      class="
        w-auto
        px-1
				flex-grow
				text-t-light-primary
				dark:text-t-dark-primary
				placeholder-t-light-faded
				dark:placeholder-t-dark-faded"
      :placeholder="placeholder"  
      @keyup="refreshSuggestions()"
    >
    <datalist :id="name">
      <option
        v-for="data in location.datalist"
        :key="data.value"
        :value="data.display"
      >
        {{ data.type }}
      </option>
    </datalist>
    <span class="flex mr-1 items-center">
      <font-awesome-icon
        :icon="name == 'destination' ? 'flag' : 'map-pin'"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          ml-1"
      />
    </span>
  </div>
</template>