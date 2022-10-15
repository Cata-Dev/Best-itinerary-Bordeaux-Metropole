<script setup lang="ts">
import { ref, watch } from "vue";
import { transportToType } from "@/store/";
import TransportBadge from "@/components/TransportBadge.vue";
import type { DefaultLocation, ParsedGeocodeLocation } from "@/components/LocationSearch.vue";

type modelValue = ParsedGeocodeLocation | DefaultLocation;

interface Props {
  placeholder: string;
  datalist?: ParsedGeocodeLocation[];
  modelValue: modelValue;
}

const props = withDefaults(defineProps<Props>(), { datalist: () => [] });

watch(
  () => props.datalist,
  (curr, old) => {
    if (JSON.stringify(curr) != JSON.stringify(old)) refreshInput();
  },
);

const showDatalist = ref<boolean>();

/**
 * Its `modelValue` is a validated `ParsedGeocodeLocation`
 * However, `input` is the input string, emitted if **validated or not** (override if **forced**).
 */
const emit = defineEmits<{
  (e: "update:modelValue", value: modelValue): void;
  (e: "input", input: string): void;
}>();

function updateModelValue(value: modelValue) {
  emit("update:modelValue", value);
}

const inputElem = ref<HTMLInputElement>();
const input = ref("");
const oldInput = ref<string>();

function refreshInput(emitInput = true) {
  if (input.value === oldInput.value) return;

  const value = props.datalist.find((v) => v.display === input.value);
  if (value) updateModelValue(value);
  // else updateModelValue({ display: '' });

  if (emitInput) emit("input", input.value);

  oldInput.value = input.value;
}

function forceInput(v: string, emitInput = true) {
  if (input.value === v) return;

  input.value = v;
  refreshInput(emitInput);
}

function focus() {
  inputElem.value?.focus();
}

defineExpose({
  focus,
  forceInput,
});
</script>

<template>
  <div class="w-full relative bg-bg-light dark:bg-bg-dark">
    <input
      ref="inputElem"
      :value="input"
      type="text"
      class="w-full flex-grow text-text-light-primary dark:text-text-dark-primary placeholder-text-light-faded dark:placeholder-text-dark-faded"
      :placeholder="placeholder"
      @input="(input = ($event.target as HTMLInputElement).value), refreshInput()"
      @focus="showDatalist = true"
      @focusout="showDatalist = false"
    />
    <div
      v-if="showDatalist && datalist.length"
      class="absolute bg-inherit shadow-xl mt-1 z-10 max-h-[40vh] overflow-y-auto w-fit"
    >
      <div
        v-for="(e, i) in datalist"
        :key="i"
        class="px-1 py-2 text-sm cursor-pointer hover:bg-bg-light-contrasted hover:dark:bg-bg-dark-contrasted"
        @mousedown="forceInput(e.display)"
      >
        <span class="ml-1 mr-2">
          {{ e.display }}
        </span>
        <TransportBadge
          v-if="e.type"
          :type="transportToType(e.type.replace('ADRESSE', 'FOOT'))"
          :transport="e.type.replace('ADRESSE', 'FOOT')"
          :custom-text="e.type.toLowerCase().capitalize()"
          class="mr-1"
        />
      </div>
    </div>
  </div>
</template>
