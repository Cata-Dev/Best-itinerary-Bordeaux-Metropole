<script setup lang="ts">
import { ref } from "vue";
import { toggleDarkMode, theme, APIRefresh } from "@/store";
import DynamicBadge from "@/components/DynamicBadge.vue";

const text = ref("Realtime");
const APIStatus = ref();

APIRefresh.result
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
      Trouver le meilleur itinéraire sur Bordeaux Métropole © 2022
    </p>
    <button
      class="flex duration-700 justify-self-end my-1 mr-2 sm:mr-4"
      :class="{ 'rotate-[360deg]': theme === 'light' }"
      @click="toggleDarkMode"
    >
      <font-awesome-icon :icon="theme === 'light' ? 'moon' : 'sun'" class="text-xl" />
    </button>
  </div>
</template>
