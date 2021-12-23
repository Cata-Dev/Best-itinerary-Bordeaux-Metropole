<script setup>
defineProps({
  shown: {
    type: Boolean,
    requiered: true,
    default: false
  },
  modelValue: {
    type: String,
    default: '',
  }
})

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
        my-3
        whitespace-nowrap
        bg-bg-light
        dark:bg-bg-dark
        text-t-light-primary
        dark:text-t-dark-primary
        rounded-lg"
      :class="{ 'max-w-full': shown }"
    >
      <div class="flex flex-col m-2">
        <div class="inline-block">
          <span>Heure de départ :</span>
          <input
            type="time"
            class="bg-transparent text-inherit time mx-1"
          >
        </div>
        <div class="inline-block">
          <span class="mr-1">Distance max à pied :</span>
          <input
            class="w-24"
            step="10"
            value="1000"
            type="number"
          >
          <span>m</span>
        </div>
        <div class="inline-block">
          <span class="mr-1">Vitesse de marche :</span>
          <input
            class="w-12"
            step="0.1"
            value="6.0"
            type="number"
          >
          <span>km/h</span>
        </div>
        <div class="inline-block">
          <span class="">Modes de transport :</span>
          <br><input
            class="ml-2"
            checked="true"
            type="checkbox"
          ><span class="ml-1">TBM</span>
          <br><input
            class="ml-2"
            checked="true"
            type="checkbox"
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