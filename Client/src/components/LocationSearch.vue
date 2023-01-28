<script setup lang="ts">
import { ref } from "vue";
import DatalistInput from "./DatalistInput.vue";
import { client, defaultLocation, type DefaultLocation, type TransportMode } from "../store/";
import type { Geocode } from "server";

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
 * The valid location (emitted modelValue)
 */
const modelValue = ref<ModelValue>(props.modelValue);
const updated = ref(0);
const updating = ref(false);

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

let lastInput = "";

async function refreshSuggestions(value: string) {
  if (value === lastInput) return;
  lastInput = value;

  if (!value || value.length < 5) {
    datalist.value = [];
    if (modelValue.value.display.length) {
      modelValue.value = defaultLocation;
      emit("update:modelValue", defaultLocation);
    }
    return;
  }

  const now = Date.now();

  const suggestions = await fetchSuggestions(value);

  // If another call was fastest, skip this one
  if (now < updated.value) return;

  datalist.value = suggestions;
  updated.value = now;

  const validLocation = suggestions.find((l) => l.display === value);
  if (validLocation) {
    modelValue.value = validLocation;
    emit("update:modelValue", validLocation);
  } else {
    // If modelValue needs reset
    if (modelValue.value.display.length) {
      modelValue.value = defaultLocation;
      emit("update:modelValue", defaultLocation);
    }
  }
}

const inputCompo = ref<InstanceType<typeof DatalistInput> | null>(null);

/**
 * Will call forceIpunt on datalistInput
 */
async function forceInput(v: string) {
  // force refreshing before the datalist does
  updating.value = true;
  await refreshSuggestions(v);
  updating.value = false;

  inputCompo.value?.forceInput(v);
}

function focus() {
  inputCompo.value?.focus();
}

defineExpose({
  focus,
  forceInput,
});
</script>

<template>
  <div
    :loading="updating"
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
      @input="refreshSuggestions($event)"
    />
    <span class="flex mr-1 items-center">
      <font-awesome-icon
        :icon="name == 'destination' ? 'flag' : 'map-pin'"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl ml-1"
      />
    </span>
  </div>
</template>
