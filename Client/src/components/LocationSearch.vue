<script setup lang="ts">
import { ref } from "vue";
import DatalistInput from "./DatalistInput.vue";
import { client, type TransportMode } from "../store/";
import type { Geocode } from "server/lib/services/geocode/geocode.schema";

export type DefaultLocation = { display: ""; type: "ADRESSE"; value: [0, 0] };

export interface ParsedGeocodeLocation {
  display: string;
  type: Exclude<TransportMode, "FOOT"> | "ADRESSE";
  value: [number, number];
}

type ModelValue = ParsedGeocodeLocation | DefaultLocation;

interface Props {
  name: string;
  placeholder: string;
  modelValue: ModelValue;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", modelValue: ModelValue): void;
}>();

const datalist = ref<ParsedGeocodeLocation[]>();
/**
 * The user input, which can be forced
 */
const input = ref<string>(props.modelValue?.display || "");
const previousInput = ref<string>();
/**
 * The validated location (emitted modelValue)
 */
const modelValue = ref<ModelValue>(props.modelValue);
const updated = ref<number>(0);

function updateModelValue(value: ParsedGeocodeLocation) {
  emit("update:modelValue", value);
}

function parseGeocode(s: Geocode): Omit<ParsedGeocodeLocation, "value"> {
  switch (s.GEOCODE_type) {
    case "Addresses":
      return {
        display: `${s.dedicated.numero} ${"rep" in s.dedicated ? s.dedicated.rep + " " : ""}${
          s.dedicated.nom_voie
        } ${s.dedicated.commune}`,
        type: "ADRESSE",
      };

    case "TBM_Stops":
      return { display: s.dedicated.libelle, type: s.dedicated.vehicule };

    case "SNCF_Stops":
      return { display: s.dedicated.name, type: "TRAIN" };

    default:
      return { display: "Unsupported location", type: "ADRESSE" };
  }
}

/**
 * @returns Can be empty
 */
async function fetchSuggestions(value: string): Promise<ParsedGeocodeLocation[]> {
  let suggestions: Geocode[] = [];
  try {
    suggestions = await client.service("geocode").find({ query: { id: value, max: 25, uniqueVoies: true } });
  } catch (_) {}

  return suggestions.map((s) => ({ value: s.coords, ...parseGeocode(s) }));
}

async function refreshSuggestions() {
  if (previousInput.value === input.value) return;
  if (!input.value || input.value.length < 5) return (datalist.value = []);

  // if (modelValue.value?.display?.length) updateModelValue(modelValue.value as ParsedGeocodeLocation);

  const now = Date.now();

  const suggestions = await fetchSuggestions(input.value);

  if (now < updated.value) return;
  datalist.value = suggestions;
  previousInput.value = input.value;
  updated.value = now;

  const validLocation = suggestions.find((l) => l.display === input.value);
  if (validLocation) updateModelValue(validLocation);
}

const inputCompo = ref<InstanceType<typeof DatalistInput> | null>(null);

function focus() {
  inputCompo.value?.focus();
}

/**
 * Will call forceIpunt on datalistInput
 * If different input, will emit input
 */
async function forceInput(v: string) {
  inputCompo.value?.forceInput(v);
  await refreshSuggestions();
}

defineExpose({
  focus,
  forceInput,
});
</script>

<template>
  <div
    class="flex w-full items-stretch relative px-3 py-2 bg-bg-light dark:bg-bg-dark rounded-full shadow-xl"
  >
    <button class="flex mr-1 items-center">
      <font-awesome-icon
        icon="crosshairs"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl"
      />
    </button>
    <DatalistInput
      ref="inputCompo"
      v-model="modelValue"
      :placeholder="placeholder"
      :datalist="datalist"
      class="px-2 flex-grow text-text-light-primary dark:text-text-dark-primary placeholder-text-light-faded dark:placeholder-text-dark-faded"
      @input="
        if (input != $event) (previousInput = input), (input = $event);
        refreshSuggestions();
      "
    />
    <span class="flex mr-1 items-center">
      <font-awesome-icon
        :icon="name == 'destination' ? 'flag' : 'map-pin'"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl ml-1"
      />
    </span>
  </div>
</template>
