<script setup lang="ts">
import { transportToIcon } from "@/store";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

defineProps<{ type: string; transport?: string; customText?: string }>();
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
    <FontAwesomeIcon
      v-if="transport !== undefined"
      :icon="transportToIcon(transport)"
      class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-size-inherit mr-2"
    />
    <span
      class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-size-inherit align-top"
    >
      <p class="inline">{{ customText ?? (type === "FOOT" ? "Marche" : type) }}</p>
    </span>
  </div>
</template>

<style scoped>
.text-size-inherit {
  font-size: inherit;
}
</style>
