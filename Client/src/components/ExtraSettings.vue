<script setup lang="ts">
import { ref } from "vue";
import { theme, type QuerySettings } from "@/store";

interface Props {
  shown: boolean;
  modelValue: QuerySettings;
}

const props = defineProps<Props>();

const settings = ref<QuerySettings>(props.modelValue);

defineEmits(["update:modelValue"]);
</script>

<template>
  <div>
    <div
      ref="accordion"
      class="flex overflow-hidden transition-all duration-500 max-w-0 max-h-fit mx-2 my-2 whitespace-nowrap bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary rounded-lg"
      :class="{ 'max-w-full': shown }"
    >
      <div class="flex flex-col m-2">
        <div class="inline-block mb-1">
          <span class="mr-2">Heure de départ</span>
          <div class="inline-block p-1 px-2 bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md">
            <input
              v-model="settings.departureTime"
              type="time"
              class="bg-transparent text-inherit time"
              :class="{ dark: theme === 'dark' }"
              @input="$emit('update:modelValue', settings)"
            />
          </div>
        </div>
        <div class="inline-block mb-1">
          <span class="mr-2">Distance max à pied</span>
          <div class="inline-block p-1 px-2 bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md">
            <input
              v-model="settings.maxWalkDistance"
              class="w-16"
              step="10"
              type="number"
              @change="$emit('update:modelValue', settings)"
            />
            <span>m</span>
          </div>
        </div>
        <div class="inline-block mb-1">
          <span class="mr-2">Vitesse de marche</span>
          <div class="inline-block p-1 px-2 bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md">
            <input
              v-model="settings.walkSpeed"
              class="w-12"
              step="0.1"
              type="number"
              @input="$emit('update:modelValue', settings)"
            />
            <span>km/h</span>
          </div>
        </div>
        <div class="inline-block">
          <span class="">Modes de transport</span>
          <div class="w-fit p-1 px-2 bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md">
            <input
              v-model="settings.transports.TBM"
              class="ml-2"
              type="checkbox"
              @change="$emit('update:modelValue', settings)"
            /><span class="ml-1">TBM</span> <br /><input
              v-model="settings.transports.SNCF"
              class="ml-2"
              type="checkbox"
              @change="$emit('update:modelValue', settings)"
            /><span class="ml-1">SNCF</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time.dark::-webkit-calendar-picker-indicator {
  filter: invert(90%);
}
.time::-webkit-datetime-edit {
  max-width: 5ch;
}
</style>
