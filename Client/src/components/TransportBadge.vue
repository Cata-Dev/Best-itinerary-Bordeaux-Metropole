<script setup>
defineProps({
  type: {
    type: String,
    required: true
  },
  transport: {
    type: String,
    required: false,
    default: ''
  },
  customText: {
    type: String,
    required: false,
    default: ''
  },
})

import { transportToIcon } from '../store';
</script>

<template>
  <div
    class="
      inline-block
      w-fit
      items-center
      rounded-xl
      px-1"
    :class="type === 'FOOT' ? 'bg-walking-bg' : type === 'TBM' ? 'bg-tbm-bg' : type === 'SNCF' ? 'bg-sncf-bg' : 'bg-slate-700'"
  >
    <font-awesome-icon
      v-if="transport"
      :icon="transportToIcon(transport)"
      class="
        text-t-light-primary
        dark:text-t-dark-primary
        text-size-inherit
        mr-2"
    />
    <span
      class="
        text-t-light-primary
        dark:text-t-dark-primary
        text-size-inherit
        align-top"
    >
      {{ customText || (type === 'FOOT' ? 'Marche' : type) }}
    </span>
  </div>
</template>

<style scoped>
.text-size-inherit {
  font-size: inherit;
}
</style>