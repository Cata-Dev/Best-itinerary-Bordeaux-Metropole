<script setup lang="ts">
import { ref, watch } from "vue";
import { defaultLocation, transportToType, type DefaultLocation } from "@/store/";
import TransportBadge from "@/components/TransportBadge.vue";
import type { ParsedGeocodeLocation } from "@/components/LocationSearch.vue";

type modelValue = ParsedGeocodeLocation | DefaultLocation;

interface Props<T> {
  placeholder: string;
  datalist?: T[];
  modelValue: T;
}

const props = withDefaults(defineProps<Props<modelValue>>(), { datalist: () => [] });

/**
 * Its `modelValue` is a value from props.datalist if input is in, defaultLocation otherwise
 * However, `input` is the raw input string, emitted at anytime
 */
const emit = defineEmits<{
  (e: "update:modelValue", value: modelValue): void;
  (e: "input", input: string): void;
}>();

watch(
  () => props.datalist,
  (curr, old) => {
    if (JSON.stringify(curr) != JSON.stringify(old)) refreshModelValue();
  },
);

const showDatalist = ref<boolean>(false);

const inputElem = ref<HTMLInputElement>();
const input = ref(props.modelValue.display);

function refreshModelValue() {
  const value = props.datalist.find((el) => el.display === input.value);
  emit("update:modelValue", value ?? defaultLocation);
}

function newInput() {
  emit("input", input.value);

  refreshModelValue();
}

function forceInput(v: string) {
  if (input.value === v) return;

  input.value = v;
  newInput();
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
      @input="(input = ($event.target as HTMLInputElement).value), newInput()"
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
