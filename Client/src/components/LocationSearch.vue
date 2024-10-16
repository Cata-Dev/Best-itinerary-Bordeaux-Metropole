<script setup lang="ts">
import { ref } from "vue";
import type { Geocode } from "server";
import DatalistInput from "./DatalistInput.vue";
import { client, defaultLocation } from "../store/";
import type { Location } from "@/store";

interface Props {
  name: string;
  placeholder: string;
  modelValue: Location;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", modelValue: Props["modelValue"]): void;
}>();

const datalist = ref<Props["modelValue"][]>();
/**
 * The valid location (emitted modelValue)
 */
const modelValue = ref<Props["modelValue"]>(props.modelValue);
const updated = ref(0);
const updating = ref(false);

function parseGeocode(s: Geocode): Props["modelValue"] {
  switch (s.GEOCODE_type) {
    case "Addresses":
      return {
        alias: `${s.dedicated.numero} ${"rep" in s.dedicated ? s.dedicated.rep + " " : ""}${
          s.dedicated.nom_voie
        } ${s.dedicated.commune}`,
        type: s.GEOCODE_type,
        id: s._id,
        coords: s.coords,
      };

    case "TBM_Stops":
      return { alias: s.dedicated.libelle, type: s.dedicated.vehicule, coords: s.coords, id: s._id };

    case "SNCF_Stops":
      return { alias: s.dedicated.name, type: "TRAIN", coords: s.coords, id: s._id };

    default:
      return { ...defaultLocation, alias: "Unsupported location" };
  }
}

/**
 * @returns Can be empty
 */
async function fetchSuggestions(value: string): Promise<Props["modelValue"][]> {
  let suggestions: Geocode[] = [];
  try {
    suggestions = await client.service("geocode").find({ query: { id: value, max: 25, uniqueVoies: true } });
  } catch (_) {}

  return suggestions.map(parseGeocode);
}

let lastInput = "";

async function refreshSuggestions(value: string) {
  if (value === lastInput) return;
  lastInput = value;

  if (!value || value.length < 5) {
    datalist.value = [];
    if (modelValue.value.alias.length) {
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

  const validLocation = suggestions.find((l) => l.alias === value);
  if (validLocation) {
    modelValue.value = validLocation;
    emit("update:modelValue", validLocation);
  } else {
    // If modelValue needs reset
    if (modelValue.value.alias.length) {
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
