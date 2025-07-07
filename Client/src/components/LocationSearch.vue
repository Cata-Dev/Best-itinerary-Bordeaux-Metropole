<script setup lang="ts">
import type { Location } from "@/store";
import { wait } from "@bibm/common/async";
import type { Geocode } from "@bibm/server";
import { ref, watch } from "vue";
import { client, defaultLocation, equalObjects } from "../store/";
import DatalistInput from "./DatalistInput.vue";

interface Props {
  name: string;
  placeholder: string;
}
defineProps<Props>();

const model = defineModel<Location | null>();

watch(model, (val, oldVal) => {
  if (!equalObjects(val, oldVal))
    refreshSuggestions(val?.alias ?? null).then(() => {
      if (val?.alias) inputCompo.value?.forceInput(val.alias);
    });
});

const datalist = ref<Location[]>([]);
const updated = ref<number>(-1);
const updating = ref<boolean>(false);

function parseGeocode(s: Geocode): Location {
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
async function fetchSuggestions(value: string): Promise<Location[]> {
  let suggestions: Geocode[] = [];
  try {
    suggestions = await client.service("geocode").find({ query: { id: value, max: 25, uniqueVoies: true } });
  } catch (_) {}

  return suggestions.map(parseGeocode);
}

let lastInput: string | null = "";
let lastInputDate: number = -1;

/**
 * Updates suggestions according to provided value.
 * Side effect on {@link datalist}.
 */
async function refreshSuggestions(value: string | null) {
  // Could have been the same through `forceInput`
  if (value === lastInput) return;
  lastInput = value;
  const inputDate = Date.now();
  lastInputDate = inputDate;

  if (!value || value.length < 5) {
    // Will trigger update of model from Datalist
    datalist.value = [];

    return;
  }

  await wait(1e3 / 3);
  if (lastInputDate != inputDate)
    // New input during threshold, cancel
    return;

  const now = Date.now();

  const suggestions = await fetchSuggestions(value);

  // If another call was faster (<=> this call has been way much longer), skip this one
  if (now < updated.value) return;

  datalist.value = suggestions;
  updated.value = now;
}

const inputCompo = ref<InstanceType<typeof DatalistInput> | null>(null);

/**
 * Will call forceInput on datalistInput
 */
async function forceInput(v: string) {
  // Force refreshing before the datalist does
  updating.value = true;
  await refreshSuggestions(v);
  updating.value = false;

  inputCompo.value?.forceInput(v);
}

defineExpose({
  focus: () => inputCompo.value?.focus(),
  forceInput,
});

const popUp = (msg: string) => alert(msg);
</script>

<template>
  <div
    :loading="updating"
    class="flex w-full items-stretch relative px-3 py-2 transition-colors duration-darkmode bg-bg-light dark:bg-bg-dark rounded-full shadow-xl"
  >
    <button class="flex mr-1 items-center" @click="popUp('Not yet :(')">
      <font-awesome-icon
        icon="crosshairs"
        class="transition-colors duration-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl"
      />
    </button>
    <DatalistInput
      ref="inputCompo"
      v-model="model"
      :placeholder="placeholder"
      :datalist="datalist"
      class="px-2 grow transition-colors duration-darkmode text-text-light-primary dark:text-text-dark-primary placeholder-text-light-faded dark:placeholder-text-dark-faded"
      @input="refreshSuggestions($event)"
    />
    <span class="flex mr-1 items-center">
      <font-awesome-icon
        :icon="name == 'destination' ? 'flag' : 'map-pin'"
        class="transition-colors duration-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl ml-1"
      />
    </span>
  </div>
</template>
