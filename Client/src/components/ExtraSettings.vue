<script setup>
import { ref } from 'vue'

const props = defineProps({
  shown: {
    type: Boolean,
    required: true,
  },
  modelValue: {
    type: Object,
    required: true
  }
})

const settings = ref(props.modelValue)

defineEmits([
  'update:modelValue',
])
</script>

<template>
  <div class="flex items-center">
    <div
      ref="accordion"
      class="
        flex
        overflow-hidden
        transition-all
        duration-500
        max-w-0
        max-h-fit
        mx-2
        my-2
        whitespace-nowrap
        bg-bg-light
        dark:bg-bg-dark
        text-text-light-primary
        dark:text-text-dark-primary
        rounded-lg"
      :class="{ 'max-w-full': shown }"
    >
      <div class="flex flex-col m-2">
        <div class="inline-block">
          <span>Heure de départ :</span>
          <input
            v-model="settings.departureTime"
            type="time"
            class="bg-transparent text-inherit time mx-1"
            @input="$emit('update:modelValue', settings)"
          >
        </div>
        <div class="inline-block">
          <span class="mr-1">Distance max à pied :</span>
          <input
            v-model="settings.maxWalkDistance"
            class="w-24"
            step="10"
            type="number"
            @change="$emit('update:modelValue', settings)"
          >
          <span>m</span>
        </div>
        <div class="inline-block">
          <span class="mr-1">Vitesse de marche :</span>
          <input
            v-model="settings.walkSpeed"
            class="w-12"
            step="0.1"
            type="number"
            @input="$emit('update:modelValue', settings)"
          >
          <span>km/h</span>
        </div>
        <div class="inline-block">
          <span class="">Modes de transport :</span>
          <br><input
            v-model="settings.transports.TBM"
            class="ml-2"
            checked="true"
            type="checkbox"
            @change="$emit('update:modelValue', settings)"
          ><span class="ml-1">TBM</span>
          <br><input
            v-model="settings.transports.SNCF"
            class="ml-2"
            checked="true"
            type="checkbox"
            @change="$emit('update:modelValue', settings)"
          ><span class="ml-1">SNCF</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(100%)
}
</style>