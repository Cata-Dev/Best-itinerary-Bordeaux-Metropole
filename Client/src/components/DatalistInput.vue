<script setup lang="ts">
import { ref, watch } from "vue";
import { equalObjects, transportToType } from "@/store/";
import TransportBadge from "@/components/TransportBadge.vue";
import type { Location } from "@/store";
import type { TBMEndpoints } from "data/models/TBM/index";

type ModelValue = Location;

interface Props<T> {
  placeholder: string;
  datalist: T[];
}

const model = defineModel<ModelValue | null>();

const props = defineProps<Props<ModelValue>>();

const emit = defineEmits<{
  /**
   * Raw input string, emitted every time it changes
   */
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
const input = ref<string>(model.value?.alias ?? "");

/**
 * Emits new modelValue only if value found & it's different from cur ent
 */
function refreshModelValue() {
  const value = props.datalist.find((el) => el.alias === input.value) ?? null;

  if (equalObjects(model.value, value)) return;

  model.value = value;
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
      v-model="input"
      type="text"
      class="w-full flex-grow text-text-light-primary dark:text-text-dark-primary placeholder-text-light-faded dark:placeholder-text-dark-faded"
      :placeholder="placeholder"
      @input="newInput()"
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
        @mousedown="forceInput(e.alias)"
      >
        <span class="ml-1 mr-2">
          {{ e.alias }}
        </span>
        <TransportBadge
          :type="transportToType(e.type.replace('Addresses' as TBMEndpoints.Addresses, 'FOOT'))"
          :transport="e.type.replace('Addresses' as TBMEndpoints.Addresses, 'FOOT')"
          :custom-text="e.type.toLowerCase().capitalize()"
          class="mr-1"
        />
      </div>
    </div>
  </div>
</template>
