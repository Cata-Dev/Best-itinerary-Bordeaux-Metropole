<script setup lang="ts">
import TransportBadge from "@/components/TransportBadge.vue";
import { formatDate, transportToIcon, type TransportMode, type TransportProvider } from "@/store/";
import { duration } from "common/lib/time"
import type { Itinerary } from "server";

interface Props {
  title: string;
  totalDuration: number;
  totalDistance: number;
  departure: number;
  from: string;
  path: Itinerary["paths"][number]["stages"];
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), { expanded: false });

const numberFormat = new Intl.NumberFormat("fr-FR").format;

interface Transport {
  provider: TransportProvider;
  mode?: TransportMode;
}

const transports: Transport[] = props.path.map((p) => ({
  provider: p.type,
  mode: "type" in p.details ? p.details.type : undefined,
}));

const uniquesTransports = transports
  .filter(
    (v, i, arr) =>
      arr.indexOf(arr.find((t) => t.provider === v.provider && t.mode === v.mode) as Transport) === i,
  )
  .map((t) => ({
    ...t,
    times: transports.filter((t2) => t2.provider === t.provider && t2.mode === t.mode).length,
  }));

const departureDate = new Date(props.departure);
const arrivalDate = new Date(props.departure + props.totalDuration * 1000);

/**
 * @description Compute duration of paths, from 0 to index
 * @param index Index (included) of the last path to compute duration
 */
function computeDuration(index: number): number {
  let duration = 0;
  for (let i = 0; i <= index; i++) {
    duration += props.path[i].duration;
  }

  return duration;
}
</script>

<template>
  <div
    v-if="expanded"
    class="bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary p-4 rounded-lg shadow-xl min-w-[40%]"
  >
    <h3 class="text-center font-bold text-xl">
      {{ title }}
    </h3>
    <div class="h-[2px] w-full my-3 bg-text-light-primary dark:bg-text-dark-primary" />
    <div class="flex w-full mt-2">
      <font-awesome-icon
        icon="clock"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl mr-2"
      />
      <span class="text-left">
        {{ duration(totalDuration * 1000, false, true) }}
      </span>
      <span class="text-right ml-auto"> {{ numberFormat(Math.round(totalDistance / 10) / 100) }} km </span>
      <font-awesome-icon
        icon="road"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div
      class="grid gap-3 grid-cols-3-auto justify-items-center items-center mt-3"
      :class="`grid-rows-${path.length * 2 + 1}`"
    >
      <!-- First first row - departure -->
      <div class="">
        {{ formatDate(departure, true) }}
      </div>
      <font-awesome-icon
        icon="map-pin"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl"
      />
      <div class="flex items-center w-full">
        <span class="h-[1px] grow min-w-[1rem] bg-text-light-primary dark:bg-text-dark-primary" />
        <span class="mx-2 text-center text-lg text-semibold">
          {{ from }}
        </span>
        <span class="h-[1px] grow min-w-[1rem] bg-text-light-primary dark:bg-text-dark-primary" />
      </div>
      <template v-for="(p, i) in path" :key="i">
        <!-- First row - header -->
        <!-- First col : mode icon -->
        <font-awesome-icon
          :icon="transportToIcon('type' in p.details ? p.details.type : p.type)"
          class="text-text-light-primary dark:text-text-dark-primary text-2xl"
        />
        <!-- Second col : linkin el (vertical bar) -->
        <div class="vertical-link border-text-light-primary dark:border-text-dark-primary" />
        <!-- Third col : details -->
        <div class="w-full pb-2">
          <div v-if="p.type === 'SNCF' || p.type === 'TBM'" class="flex items-center">
            <TransportBadge
              :type="p.type"
              :custom-text="'line' in p.details ? p.details.line : 'unknown'"
              class="mr-2"
            />
            <span class="text-sm"> ➜ {{ "direction" in p.details ? p.details.direction : "unknonw" }} </span>
          </div>
          <div class="text-sm" :class="{ 'mt-1': p.type === 'SNCF' || p.type === 'TBM' }">
            {{ duration(p.duration * 1000, false, true) }}
          </div>
        </div>
        <!-- Second row - content -->
        <!-- First col : time -->
        <div class="">
          {{
            formatDate(
              path[i + 1] && "departure" in path[i + 1].details
                ? (path[i + 1].details as any).departure
                : departure + computeDuration(i) * 1000,
              true,
            )
          }}
        </div>
        <!-- Second col : icon (start/bullet/end) -->
        <font-awesome-icon
          v-if="i === path.length - 1"
          icon="flag"
          class="text-text-light-primary dark:text-text-dark-primary text-2xl"
        />
        <div v-else class="bullet bg-text-light-primary dark:bg-text-dark-primary" />
        <!-- Third col : position -->
        <div class="flex items-center w-full">
          <span class="h-[1px] grow min-w-[1rem] bg-text-light-primary dark:bg-text-dark-primary" />
          <span class="mx-2 text-center text-lg text-semibold">
            {{ p.to }}
          </span>
          <span class="h-[1px] grow min-w-[1rem] bg-text-light-primary dark:bg-text-dark-primary" />
        </div>
      </template>
    </div>
  </div>
  <div
    v-else
    class="bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary p-3 rounded-lg shadow-xl"
  >
    <h3 class="text-center font-bold text-lg">
      {{ title }}
    </h3>
    <div class="h-[2px] w-full my-3 bg-text-light-primary dark:bg-text-dark-primary" />
    <div class="flex w-full">
      <font-awesome-icon
        icon="clock"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl mr-2"
      />
      <span class="text-left">
        {{ duration(totalDuration * 1000, false, true) }}
      </span>
      <span class="text-right ml-auto"> {{ numberFormat(Math.round(totalDistance / 10) / 100) }} km </span>
      <font-awesome-icon
        icon="road"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div class="flex w-full mt-2">
      <font-awesome-icon
        icon="map-pin"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl mr-2"
      />
      <span class="text-left">
        {{ formatDate(departureDate, departureDate.getDate() === new Date().getDate()) }}
      </span>
      <span class="text-right ml-auto">
        {{ formatDate(arrivalDate, arrivalDate.getDate() === new Date().getDate()) }}
      </span>
      <font-awesome-icon
        icon="flag"
        class="text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div class="mt-2">
      <div v-for="(e, i) in uniquesTransports" :key="e.mode" class="inline-block mt-1">
        {{ e.times }}×
        <TransportBadge
          :type="e.provider"
          :mode="e.mode"
          :class="{ 'mr-2': i < uniquesTransports.length - 1 }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bullet {
  width: 8px;
  height: 8px;
  @apply rounded-lg;
}

.vertical-link {
  margin-right: 1px;
  height: 125%;
  @apply w-0;
  @apply border-r-2;
  @apply border-dashed;
}

.grid-cols-3-auto {
  grid-template-columns: repeat(3, auto);
}
</style>
