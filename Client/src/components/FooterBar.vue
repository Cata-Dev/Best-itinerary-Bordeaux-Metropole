<script setup lang="ts">
import DynamicBadge from "@/components/DynamicBadge.vue";
import { APIRefresh, ClientStatus, clientStatus, theme, toggleDarkMode } from "@/store";
import { faCheckCircle, faCircleHalfStroke, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { ref } from "vue";

const realtimeDetails = ref("fetching...");

APIRefresh.promise
  .then((r) => {
    realtimeDetails.value = `(${new Date(r.lastActualization).toLocaleTimeString()})`;
  })
  .catch(() => {
    realtimeDetails.value = ` unavailable`;
  });
</script>

<template>
  <div class="flex gap-2 sm:gap-3 items-center">
    <div class="flex w-fit my-[0.33rem] ml-2 sm:ml-4 justify-start">
      <DynamicBadge
        :text="`Realtime ${realtimeDetails}`"
        :color="
          clientStatus === ClientStatus.Connected
            ? 'success'
            : clientStatus === ClientStatus.ConnectionError
              ? 'alert'
              : 'info'
        "
        :icon="
          clientStatus === ClientStatus.Connected
            ? faCheckCircle
            : clientStatus === ClientStatus.ConnectionError
              ? faExclamationTriangle
              : 'loading'
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
      <FontAwesomeIcon
        :icon="faCircleHalfStroke"
        class="text-xl transition-transform duration-darkmode text-text-light-primary dark:text-text-dark-primary"
      />
    </button>
  </div>
</template>
