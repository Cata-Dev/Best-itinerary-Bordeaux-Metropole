<script setup lang="ts">
import { transportToIcon } from "@/store";

defineProps({
  type: {
    type: String,
    required: true,
  },
  transport: {
    type: String,
    required: false,
    default: "",
  },
  customText: {
    type: String,
    required: false,
    default: "",
  },
});
</script>

<template>
  <div
    class="inline-block w-fit items-center rounded-xl px-1"
    :class="
      type === 'FOOT'
        ? 'bg-walking-bg'
        : type === 'TBM'
        ? 'bg-tbm-bg'
        : type === 'SNCF'
        ? 'bg-sncf-bg'
        : 'bg-slate-700'
    "
  >
    <font-awesome-icon
      v-if="transport"
      :icon="transportToIcon(transport)"
      class="text-text-light-primary dark:text-text-dark-primary text-size-inherit mr-2"
    />
    <span class="text-text-light-primary dark:text-text-dark-primary text-size-inherit align-top">
      <p class="inline">{{ customText || (type === "FOOT" ? "Marche" : type) }}</p>
    </span>
  </div>
</template>

<style scoped>
.text-size-inherit {
  font-size: inherit;
}
</style>
