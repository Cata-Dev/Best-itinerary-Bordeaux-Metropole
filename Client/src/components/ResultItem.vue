<!-- eslint-disable @typescript-eslint/no-non-null-assertion -->
<script setup lang="ts">
import BaseModal from "@/components/BaseModal.vue";
import TransportBadge from "@/components/TransportBadge.vue";
import type { Props as VecMapProps } from "@/components/VecMap.vue";
import VecMap from "@/components/VecMap.vue";
import {
  formatDate,
  formatInterval,
  transportToIcon,
  type TransportMode,
  type TransportProvider,
} from "@/store/";
import { currentJourney, fetchFootpaths, result, type Journey } from "@/store/api";
import { duration } from "@bibm/common/time";
import type { Transport as ServerTransport } from "@bibm/server/services/journey/journey.schema";
import { faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { MultiLineString, Point } from "ol/geom";
import Fill from "ol/style/Fill";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import { computed, ref, useTemplateRef } from "vue";

interface Props {
  title: string;
  from: string;
  path: Journey["paths"][number][number];
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), { expanded: false });

const numberFormat = (val: number) => new Intl.NumberFormat("fr-FR").format(val);

interface Transport {
  provider: TransportProvider;
  mode?: TransportMode;
}

const transports = computed<Transport[]>(() =>
  props.path.stages.map((p) => ({
    provider: p.type,
    mode: "type" in p.details ? p.details.type : "FOOT",
  })),
);

const uniqueTransports = computed(() =>
  transports.value
    .filter(
      (v, i, arr) => arr.indexOf(arr.find((t) => t.provider === v.provider && t.mode === v.mode)!) === i,
    )
    .map((t) => ({
      ...t,
      times: transports.value.filter((t2) => t2.provider === t.provider && t2.mode === t.mode).length,
    })),
);

const departure = computed(() => props.path.stages[0]!.departure);
const lastStage = computed(() => props.path.stages.at(-1)!);
const arrival = computed(
  () =>
    [
      lastStage.value.departure[0] + lastStage.value.duration[0] * 1000,
      lastStage.value.departure[1] + lastStage.value.duration[1] * 1000,
    ] satisfies [unknown, unknown],
);
const totalDistance = computed(() =>
  props.path.stages.reduce((acc, v) => acc + ("distance" in v.details ? v.details.distance : 0), 0),
);

const modalMapComp = useTemplateRef("modalMapComp");

function getClosesPointToMiddle(geom: MultiLineString) {
  const geomExtent = geom.getExtent();
  return new Point(
    geom.getClosestPoint([
      ((geomExtent[0] ?? 0) + (geomExtent[2] ?? 0)) / 2,
      ((geomExtent[1] ?? 0) + (geomExtent[3] ?? 0)) / 2,
    ]),
  );
}

const paths = ref<VecMapProps["multiLineStrings"]["data"]>([]);
const multiLineStringsStyle: VecMapProps["multiLineStrings"]["style"] = (feature) => {
  const styles: Style[] = [];
  switch (feature.getProperties().props.type as ServerTransport) {
    case "FOOT" as ServerTransport.FOOT:
      styles.push(
        new Style({
          stroke: new Stroke({
            width: 5,
            color: [0, 0, 0],
            lineDash: [10],
          }),
        }),
        new Style({
          geometry: getClosesPointToMiddle(feature.getGeometry() as MultiLineString),
          image: new Icon({
            opacity: 1,
            src:
              "data:image/svg+xml;utf8," +
              `<svg width="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${faPersonWalking.icon[0]} ${faPersonWalking.icon[1]}"><path d="${faPersonWalking.icon[4] as string}"/></svg>`,
          }),
        }),
      );
      break;

    case "TBM" as ServerTransport.TBM:
      styles.push(
        new Style({
          stroke: new Stroke({
            width: 4,
            // Should be TBM line color
            color: [200, 0, 0],
          }),
        }),
      );
      if (
        "stageIdx" in feature.getProperties().props &&
        currentJourney.value &&
        "line" in (currentJourney.value.stages[feature.getProperties().props.stageIdx]?.details ?? {})
      )
        styles.push(
          new Style({
            geometry: getClosesPointToMiddle(feature.getGeometry() as MultiLineString),
            text: new Text({
              text: (
                currentJourney.value.stages[feature.getProperties().props.stageIdx]!.details as Extract<
                  Journey["paths"][number][number]["stages"][number]["details"],
                  { line: unknown }
                >
              ).line,
              fill: new Fill({
                // Text color
                color: "black",
              }),
              padding: [3, 3, 3, 3],
              overflow: true,
              backgroundFill: new Fill({
                // Background color
                color: [200, 0, 0],
              }),
              placement: "point",
              textBaseline: "ideographic",
            }),
          }),
        );
      break;
  }

  return styles;
};

async function displayMap() {
  if (result.value === null) throw new Error("Unexpected unset result.");
  if (currentJourney.value === null) throw new Error("Unexpected unset current journey.");

  modalMapComp.value?.show(true);

  paths.value.splice(
    0,
    paths.value.length,
    ...(await fetchFootpaths(result.value.id, currentJourney.value.idx)).reduce<
      VecMapProps["multiLineStrings"]["data"]
    >(
      (acc, v, i) =>
        v.steps[0]![0] instanceof Array
          ? acc.concat([
              {
                coords: v.steps as VecMapProps["multiLineStrings"]["data"][number]["coords"],
                props: { type: v.type, stageIdx: i, ...("line" in v ? { line: v.line } : {}) },
              },
            ])
          : acc,
      [],
    ),
  );
}
</script>

<template>
  <div
    v-if="expanded"
    class="transition-darkmode bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary p-4 rounded-lg shadow-xl min-w-[40%] h-fit"
  >
    <div class="flex place-content-center">
      <h3 class="mx-auto text-center font-bold text-xl">
        {{ title }}
      </h3>
      <button @click="displayMap()">
        <font-awesome-icon
          icon="map"
          class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl"
        />
      </button>
    </div>
    <div class="h-[2px] w-full my-3 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary" />
    <div class="flex w-full mt-2">
      <font-awesome-icon icon="clock" class="transition-darkmode text-2xl mr-2" />
      <span class="text-left">
        {{
          formatInterval(
            ...(Array.from(
              { length: 2 },
              (_, i) => duration(arrival[i]! - departure[(i + 1) % 2]!, false, true) || "< 1m",
            ) as [string, string]),
          )
        }}
      </span>
      <span class="text-right ml-auto"> {{ numberFormat(Math.round(totalDistance / 10) / 100) }} km </span>
      <font-awesome-icon
        icon="person-walking"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div v-if="'bufferTime' in path.criteria || 'successProbaInt' in path.criteria" class="flex w-full mt-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        class="transition-darkmode fill-text-light-primary dark:fill-text-dark-primary h-[1em] text-2xl mr-2"
      >
        <!--! Font Awesome Pro 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2024 Fonticons, Inc. -->
        <path
          d="M269.4 2.9C265.2 1 260.7 0 256 0s-9.2 1-13.4 2.9L54.3 82.8c-22 9.3-38.4 31-38.3 57.2c.5 99.2 41.3 280.7 213.6 363.2c16.7 8 36.1 8 52.8 0C454.7 420.7 495.5 239.2 496 140c.1-26.2-16.3-47.9-38.3-57.2L269.4 2.9zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"
        />
      </svg>
      <template v-if="'bufferTime' in path.criteria && (path.criteria.bufferTime as number) < 0">
        <span>
          {{ (path.criteria.bufferTime as number) > 0 ? "-" : ""
          }}{{
            duration(
              (path.criteria.bufferTime as
                | number
                // -Infinity serialized as 'null'
                | null) ?? Infinity,
              false,
              true,
            ) || "< 1m"
          }}
        </span>
      </template>
      <template
        v-if="
          'successProbaInt' in path.criteria &&
          (!('bufferTime' in path.criteria) || (path.criteria.bufferTime as number) >= 0)
        "
      >
        <span> &nbsp;{{ Math.round(-(path.criteria.successProbaInt as number) * 100_00) / 100 }}% </span>
      </template>
    </div>

    <div
      class="grid gap-3 grid-cols-3-auto justify-items-center items-center mt-3"
      :class="`grid-rows-${path.stages.length * 2 + 1}`"
    >
      <!-- First first row - departure -->
      <div class="">
        {{ formatInterval(...(departure.map((time) => formatDate(time, true)) as [string, string])) }}
      </div>
      <font-awesome-icon
        icon="map-pin"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl"
      />
      <div class="flex items-center w-full">
        <span class="h-px grow min-w-4 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary" />
        <span class="mx-2 text-center text-lg text-semibold">
          {{ from }}
        </span>
        <span class="h-px grow min-w-4 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary" />
      </div>
      <template v-for="(p, i) in path.stages" :key="i">
        <!-- First row - header -->
        <!-- First col : mode icon -->
        <font-awesome-icon
          :icon="transportToIcon('type' in p.details ? p.details.type : p.type)"
          class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl"
        />
        <!-- Second col : linkin el (vertical bar) -->
        <div
          class="vertical-link transition-darkmode border-text-light-primary dark:border-text-dark-primary"
        />
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
            {{
              formatInterval(
                ...(p.duration.map((d) => duration(d * 1000, false, true) || "< 1m") as [string, string]),
              )
            }}
          </div>
        </div>
        <!-- Second row - content -->
        <!-- First col : time -->
        <div class="">
          {{
            formatInterval(
              ...((path.stages[i + 1]?.departure ?? arrival).map((time) => formatDate(time, true)) as [
                string,
                string,
              ]),
            )
          }}
        </div>
        <!-- Second col : icon (start/bullet/end) -->
        <font-awesome-icon
          v-if="i === path.stages.length - 1"
          icon="flag"
          class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl"
        />
        <div v-else class="bullet transition-darkmode bg-text-light-primary dark:bg-text-dark-primary" />
        <!-- Third col : position -->
        <div class="flex items-center w-full">
          <span
            class="h-px grow min-w-4 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary"
          />
          <span class="mx-2 text-center text-lg text-semibold">
            {{ p.to }}
          </span>
          <span
            class="h-px grow min-w-4 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary"
          />
        </div>
      </template>
    </div>
    <BaseModal
      ref="modalMapComp"
      :main-classes="[
        'bg-bg-light',
        'dark:bg-bg-dark',
        'text-text-light-primary',
        'dark:text-text-dark-primary',
      ]"
    >
      <template #title>
        <h1 class="text-2xl text-center">Trajets à pied</h1>
      </template>
      <template #content>
        <VecMap :multi-line-strings="{ data: paths, style: multiLineStringsStyle }"> </VecMap>
      </template>
    </BaseModal>
  </div>
  <div
    v-else
    class="transition-darkmode bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary p-3 rounded-lg shadow-xl"
  >
    <h3 class="text-center font-bold text-lg">
      {{ title }}
    </h3>
    <div class="h-[2px] w-full my-3 transition-darkmode bg-text-light-primary dark:bg-text-dark-primary" />
    <div class="flex w-full">
      <font-awesome-icon
        icon="clock"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl mr-2"
      />
      <span class="text-left">
        {{
          formatInterval(
            ...(Array.from(
              { length: 2 },
              (_, i) => duration(arrival[i]! - departure[(i + 1) % 2]!, false, true) || "< 1m",
            ) as [string, string]),
          )
        }}
      </span>
      <span class="text-right ml-auto"> {{ numberFormat(Math.round(totalDistance / 10) / 100) }} km </span>
      <font-awesome-icon
        icon="person-walking"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div v-if="'bufferTime' in path.criteria || 'successProbaInt' in path.criteria" class="flex w-full mt-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        class="transition-darkmode fill-text-light-primary dark:fill-text-dark-primary h-[1em] text-2xl mr-2"
      >
        <!--! Font Awesome Pro 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2024 Fonticons, Inc. -->
        <path
          d="M269.4 2.9C265.2 1 260.7 0 256 0s-9.2 1-13.4 2.9L54.3 82.8c-22 9.3-38.4 31-38.3 57.2c.5 99.2 41.3 280.7 213.6 363.2c16.7 8 36.1 8 52.8 0C454.7 420.7 495.5 239.2 496 140c.1-26.2-16.3-47.9-38.3-57.2L269.4 2.9zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"
        />
      </svg>
      <template v-if="'bufferTime' in path.criteria && (path.criteria.bufferTime as number) < 0">
        <span>
          {{ (path.criteria.bufferTime as number) > 0 ? "-" : ""
          }}{{
            duration(
              (path.criteria.bufferTime as
                | number
                // -Infinity serialized as 'null'
                | null) ?? Infinity,
              false,
              true,
            ) || "< 1m"
          }}
        </span>
      </template>
      <template
        v-if="
          'successProbaInt' in path.criteria &&
          (!('bufferTime' in path.criteria) || (path.criteria.bufferTime as number) >= 0)
        "
      >
        <span> {{ Math.round(-(path.criteria.successProbaInt as number) * 100_00) / 100 }}% </span>
      </template>
    </div>
    <div class="flex w-full mt-2">
      <font-awesome-icon
        icon="map-pin"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl mr-2"
      />
      <span class="text-left">
        {{
          formatInterval(
            ...(departure.map((time) =>
              formatDate(time, new Date(time).getDate() === new Date().getDate()),
            ) as [string, string]),
          )
        }}
      </span>
      <span class="text-right ml-auto">
        {{
          formatInterval(
            ...(arrival.map((time) =>
              formatDate(time, new Date(time).getDate() === new Date().getDate()),
            ) as [string, string]),
          )
        }}
      </span>
      <font-awesome-icon
        icon="flag"
        class="transition-darkmode text-text-light-primary dark:text-text-dark-primary text-2xl ml-2"
      />
    </div>
    <div class="mt-2">
      <div v-for="(e, i) in uniqueTransports" :key="i" class="inline-block mt-1">
        {{ e.times }}×
        <TransportBadge
          :type="e.provider"
          :transport="e.mode"
          :class="{ 'mr-2': i < uniqueTransports.length - 1 }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../index.css";

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
