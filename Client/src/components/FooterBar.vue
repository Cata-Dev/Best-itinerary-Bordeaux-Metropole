<script setup lang="ts">
import { ref } from "vue";
import { toggleDarkMode, theme, APIRefresh } from "@/store";
import DynamicBadge from "@/components/DynamicBadge.vue";

const text = ref("Realtime");
const APIStatus = ref();

APIRefresh.promise
  .then((r) => {
    APIStatus.value = "ready";
    text.value = `Realtime (${new Date(r.lastActualization).toLocaleTimeString()})`;
  })
  .catch(() => {
    APIStatus.value = "dead";
  });
</script>

<template>
  <div class="flex gap-2 sm:gap-3 items-center">
    <div class="flex w-fit my-[0.33rem] ml-2 sm:ml-4 justify-start">
      <DynamicBadge
        :text="text"
        :color="APIStatus === 'ready' ? 'success' : APIStatus === 'dead' ? 'alert' : 'info'"
        :icon="
          APIStatus === 'ready' ? 'check-circle' : APIStatus === 'dead' ? 'exclamation-triangle' : 'loading'
        "
        :bg="false"
      />
    </div>
    <p class="w-full text-center text-xs text-text-light-faded dark:text-text-dark-faded">
      Trouver le meilleur itinéraire sur Bordeaux Métropole © 2025
    </p>
    <button
      class="flex transition-transform duration-darkmode justify-self-end my-1 mr-2 sm:mr-4"
      :class="{
        'rotate-90': theme === 'auto-light' || theme === 'auto-dark',
        'rotate-180': theme === 'dark',
      }"
      @click="toggleDarkMode"
    >
      <font-awesome-icon
        icon="circle-half-stroke"
        class="text-xl transition-transform duration-darkmode text-text-light-primary dark:text-text-dark-primary"
      />
    </button>
  </div>
</template>
