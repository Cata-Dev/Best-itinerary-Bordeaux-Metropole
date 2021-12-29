<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  totalDuration: {
    type: Number,
    required: true,
  },
  totalDistance: {
    type: Number,
    required: true,
  },
  departure: {
    type: Number,
    required: true,
  },
  from: {
    type: String,
    required: true,
  },
  path: {
    type: Array,
    required: true,
  },
  expanded: {
    type: Boolean,
    required: false,
    default: false,
  },
})

import TransportBadge from './TransportBadge.vue'
import { duration, formatDate } from '../store'
const numberFormat = new Intl.NumberFormat('fr-FR').format

const transports = props.path.map(p => ({
  type: p.type,
  transport: p?.details?.type || p.type //'FOOT' or unwanted
}))
const uniquesTransports = transports
  .filter((v, i, arr) => arr.indexOf(arr.find(t => t.type === v.type && t.transport === v.transport)) === i)
  .map(t => ({
    ...t,
    times: transports.filter(t2 => t2.type === t.type && t2.transport === t.transport).length
  }))
const departureDate = new Date(props.departure)
const arrivalDate = new Date(props.departure + props.totalDuration*1000)

/**
 * @description Compute duration of paths, from 0 to index
 * @param {Number} index Index (included) of the last path to compute duration
 * @returns {Number}
 */
function computeDuration(index) {
  let duration = 0
  for (let i = 0; i <= index; i++) {
    duration += props.path[i].duration
  }
  return duration
}

import { transportToIcon } from '../store';

</script>

<template>
  <div
    v-if="expanded"
    class="
      bg-bg-light
      dark:bg-bg-dark
      text-t-light-primary
      dark:text-t-dark-primary
      p-4
      rounded-lg
      shadow-xl
      min-w-[40%]"
  >
    <h3
      class="
        text-center
        font-bold
        text-xl"
    >
      {{ title }}
    </h3>
    <div class="h-[2px] w-full my-3 bg-t-light-primary dark:bg-t-dark-primary" />
    <div
      class="
        flex
        w-full
        mt-2"
    >
      <font-awesome-icon
        icon="clock"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          mr-2"
      />
      <span
        class="
          text-left"
      >
        {{ duration(totalDuration*1000, false, true) }}
      </span>
      <span
        class="
          text-right
          ml-auto"
      >
        {{ numberFormat(Math.round(totalDistance/10)/100) }} km
      </span>
      <font-awesome-icon
        icon="road"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          ml-2"
      />
    </div>
    <div
      class="
        grid
        gap-3
        grid-cols-3-auto
        justify-items-center
        items-center
        mt-3"
      :class="`grid-rows-${path.length*2+1}`"
    >
      <!-- First first row - departure -->
      <div
        class=""
      >
        {{ formatDate(departure, true) }}
      </div>
      <font-awesome-icon
        icon="map-pin"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl"
      />
      <div
        class="
          w-full
          text-center
          text-lg
          text-semibold"
      >
        {{ from }}
      </div>
      <template
        v-for="(p, i) in path"
        :key="i"
      >
        <!-- First row - header -->
        <!-- First col : transport icon -->
        <font-awesome-icon
          :icon="transportToIcon(p?.details?.type || p.type)"
          class="
            text-t-light-primary
            dark:text-t-dark-primary
            text-2xl"
        />
        <!-- Second col : linkin el (vertical bar) -->
        <div
          class="
            vertical-link
            border-t-light-primary
            dark:border-t-dark-primary"
        />
        <!-- Third col : details -->
        <div
          class="
            w-full
            pb-3
            border-b
            border-t-light-faded
            dark:border-t-dark-faded"
        >
          <div
            v-if="p.type === 'SNCF' || p.type === 'TBM'"
            class="flex items-center"
          >
            <TransportBadge
              :type="p.type"
              :custom-text="p.details.line"
              class="mr-2"
            />
            <span
              class="text-sm"
            >
              ➜ {{ p.details.direction }}
            </span>
          </div>
          <div
            class="text-sm"
            :class="{ 'mt-1': p.type === 'SNCF' || p.type === 'TBM' }"
          >
            {{ duration(p.duration*1000, false, true) }}
          </div>
        </div>
        <!-- Second row - content -->
        <!-- First col : time -->
        <div
          class=""
        >
          {{ formatDate(p[i+1]?.departure || departure+computeDuration(i)*1000, true) }}
        </div>
        <!-- Second col : icon (start/bullet/end) -->
        <font-awesome-icon
          v-if="i === path.length-1"
          icon="flag"
          class="
            text-t-light-primary
            dark:text-t-dark-primary
            text-2xl"
        />
        <div
          v-else
          class="
            bullet
            bg-t-light-primary
            dark:bg-t-dark-primary"
        />
        <!-- Third col : position -->
        <div
          class="
            w-full
            text-center
            text-lg
            text-semibold"
        >
          {{ p.to }}
        </div>
      </template>
    </div>
  </div>
  <div
    v-else
    class="
      bg-bg-light
      dark:bg-bg-dark
      text-t-light-primary
      dark:text-t-dark-primary
      p-3
      rounded-lg
      shadow-xl"
  >
    <h3
      class="
        text-center
        font-bold
        text-lg"
    >
      {{ title }}
    </h3>
    <div class="h-[2px] w-full my-3 bg-t-light-primary dark:bg-t-dark-primary" />
    <div
      class="
        flex
        w-full"
    >
      <font-awesome-icon
        icon="clock"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          mr-2"
      />
      <span
        class="
          text-left"
      >
        {{ duration(totalDuration*1000, false, true) }}
      </span>
      <span
        class="
          text-right
          ml-auto"
      >
        {{ numberFormat(Math.round(totalDistance/10)/100) }} km
      </span>
      <font-awesome-icon
        icon="road"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          ml-2"
      />
    </div>
    <div
      class="
        flex
        w-full
        mt-2"
    >
      <font-awesome-icon
        icon="map-pin"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          mr-2"
      />
      <span
        class="
          text-left"
      >
        {{ formatDate(departureDate, departureDate.getDate() === (new Date()).getDate()) }}
      </span>
      <span
        class="
          text-right
          ml-auto"
      >
        {{ formatDate(arrivalDate, arrivalDate.getDate() === (new Date()).getDate()) }}
      </span>
      <font-awesome-icon
        icon="flag"
        class="
          text-t-light-primary
          dark:text-t-dark-primary
          text-2xl
          ml-2"
      />
    </div>
    <div
      class="mt-2"
    >
      <div
        v-for="(e, i) in uniquesTransports"
        :key="e.transport"
        class="inline-block mt-1"
      >
        {{ e.times }}×
        <TransportBadge
          :type="e.type"
          :transport="e.transport"
          :class="{ 'mr-2': i < uniquesTransports.length-1 }"
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