<script setup lang="ts">
import BaseModal from "@/components/BaseModal.vue";
import { type QuerySettings } from "@/store";
import { onUpdated, ref } from "vue";

const modalComp = ref<InstanceType<typeof BaseModal> | null>(null);

interface Props {
  initShown?: boolean;
  modelValue: QuerySettings;
}
const props = withDefaults(defineProps<Props>(), { initShown: false });

const emit = defineEmits<{
  (e: "update:shown", shown: boolean): void;
  (e: "update:modelValue", settings: QuerySettings): void;
}>();

const settings = ref<QuerySettings>(props.modelValue);

const breakpoint =
  parseInt(getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-xl").match(/\d+/)![0]) *
  // In rem
  16;

const shown = ref<boolean>(props.initShown);
function show(s = !shown.value) {
  if (modalComp.value?.shown != s && width.value <= breakpoint) modalComp.value?.show(s);
  if (s === shown.value) return;
  shown.value = s;
  emit("update:shown", s);
}

defineExpose({
  show,
  shown,
});

const width = ref<number>(window.innerWidth);
addEventListener("resize", () => {
  if (width.value > breakpoint === window.innerWidth <= breakpoint) modalCompNeedUpdate = true;
  width.value = window.innerWidth;
});

let modalCompNeedUpdate = false;
onUpdated(() => {
  if (modalCompNeedUpdate) modalComp.value?.show(shown.value);
});
</script>

<template>
  <div v-if="width > breakpoint">
    <div
      ref="accordion"
      class="flex overflow-hidden transition-all duration-darkmode max-w-0 max-h-fit mx-2 my-2 whitespace-nowrap bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary rounded-lg"
      :class="{ 'max-w-full': shown }"
    >
      <div class="m-2">
        <div class="flex flex-col">
          <div class="flex items-center">
            <p class="mr-2">Date de départ</p>
            <span
              class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
            >
              <input
                v-model="settings.departureTime"
                type="datetime-local"
                class="bg-transparent text-inherit time"
                @input="$emit('update:modelValue', settings)"
              />
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Distance max à pied</p>
            <span
              class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
            >
              <input
                v-model="settings.maxWalkDistance"
                class="w-16"
                step="10"
                type="number"
                @change="$emit('update:modelValue', settings)"
              />
              <span>m</span>
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Vitesse de marche</p>
            <span
              class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
            >
              <input
                v-model="settings.walkSpeed"
                class="w-12"
                step="0.1"
                type="number"
                @input="$emit('update:modelValue', settings)"
              />
              <span>km/h</span>
            </span>
          </div>
          <div class="flex items-center mt-1">
            <p class="mr-2">Modes de transport</p>
            <span
              class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
            >
              <input
                v-model="settings.transports.TBM"
                class="ml-2"
                type="checkbox"
                @change="$emit('update:modelValue', settings)"
              /><span class="ml-1">TBM</span> <br />
              <input
                v-model="settings.transports.SNCF"
                class="ml-2"
                type="checkbox"
                @change="$emit('update:modelValue', settings)"
              /><span class="ml-1">SNCF</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <BaseModal
    v-else
    ref="modalComp"
    :main-classes="[
      'bg-bg-light',
      'dark:bg-bg-dark',
      'text-text-light-primary',
      'dark:text-text-dark-primary',
    ]"
    @update:shown="
      (s: boolean) => {
        if (s != shown) show();
      }
    "
  >
    <template #title>
      <h1 class="text-2xl text-center">Paramètres</h1>
    </template>
    <template #content>
      <div class="flex flex-col">
        <div class="flex items-center">
          <p class="mr-2">Heure de départ</p>
          <span
            class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
          >
            <input
              v-model="settings.departureTime"
              type="datetime-local"
              class="bg-transparent text-inherit time"
              @input="$emit('update:modelValue', settings)"
            />
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Distance max à pied</p>
          <span
            class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
          >
            <input
              v-model="settings.maxWalkDistance"
              class="w-16"
              step="10"
              type="number"
              @change="$emit('update:modelValue', settings)"
            />
            <span>m</span>
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Vitesse de marche</p>
          <span
            class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
          >
            <input
              v-model="settings.walkSpeed"
              class="w-12"
              step="0.1"
              type="number"
              @input="$emit('update:modelValue', settings)"
            />
            <span>km/h</span>
          </span>
        </div>
        <div class="flex items-center mt-1">
          <p class="mr-2">Modes de transport</p>
          <span
            class="align-middle p-1 px-2 transition-colors duration-darkmode bg-bg-light-contrasted dark:bg-bg-dark-contrasted rounded-md"
          >
            <input
              v-model="settings.transports.TBM"
              class="ml-2"
              type="checkbox"
              @change="$emit('update:modelValue', settings)"
            /><span class="ml-1">TBM</span> <br />
            <input
              v-model="settings.transports.SNCF"
              class="ml-2"
              type="checkbox"
              @change="$emit('update:modelValue', settings)"
            /><span class="ml-1">SNCF</span>
          </span>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.time.dark::-webkit-calendar-picker-indicator {
  filter: invert(90%);
}
</style>
