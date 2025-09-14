<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

defineProps<{
  text: string;
  icon: "loading" | IconDefinition;
  color: "success" | "info" | "alert";
  bg?: boolean;
}>();
</script>

<template>
  <div
    class="flex py-0.5 px-2 rounded-full items-center border-2"
    :class="
      color === 'success'
        ? [{ 'bg-success-bg': bg }, 'border-success-t']
        : color === 'info'
          ? [{ 'bg-info-bg': bg }, 'border-info-t']
          : [{ 'bg-alert-bg': bg }, 'border-alert-t']
    "
  >
    <span
      class="mr-1 text-sm whitespace-nowrap"
      :class="
        color === 'success' ? ['text-success-t'] : color === 'info' ? ['text-info-t'] : ['text-alert-t']
      "
    >
      <p class="inline">{{ text }}</p>
    </span>
    <div
      v-if="icon === 'loading'"
      class="spinner-border animate-spin inline-block w-4 h-4 squared border-2 rounded-full border-info-t"
      role="status"
    />
    <FontAwesomeIcon v-else :icon="icon" class="text-xl" :class="`text-${color}-t`" />
  </div>
</template>

<style scoped>
.spinner-border {
  border-right: 0.25em solid transparent;
}
</style>
