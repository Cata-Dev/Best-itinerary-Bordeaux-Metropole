<template>
  <div class="grid grid-cols-3 gap-3 content-center">
    <div class="flex justify-start self-center">
      <DynamicBadge
        :text="text"
        :color="APIStatus === 'ready' ? 'success' : APIStatus === 'dead' ? 'alert' : 'info'"
        :icon="APIStatus === 'ready' ? 'check-circle' : APIStatus === 'dead' ? 'exclamation-triangle' : 'loading'"
        :bg="false"
      />
    </div>
    <p
      class="
        my-auto
        text-center
        text-sm
        text-t-light-faded
        dark:text-t-dark-faded"
    >
      Trouver le meilleur itinéraire sur Bordeaux Métropole © 2021
    </p>
    <button
      class="flex duration-700 justify-self-end self-center my-1 mr-4"
      :class="{ 'rotate-[360deg]': theme === 'light' }"
      @click="toggleDarkMode"
    >
      <font-awesome-icon
        :icon="theme === 'light' ? 'moon' : 'sun'"
        class="text-xl"
      />
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'
import { toggleDarkMode, theme, APIRefresh } from '../store'
import DynamicBadge from './Badge.vue'

export default {
    name: 'FooterBar',
    components: {
      DynamicBadge,
    },
    setup() {

      const init = new Date()
      const text = ref('Realtime')

      const APIStatus = ref(null)

      APIRefresh.value.then((r) => {
        if (r.code && r.code == 200) {
          APIStatus.value = 'ready'
          text.value = `Realtime (${init.toLocaleTimeString()})`
        }
        else APIStatus.value = 'dead'
      }).catch(() => {
        APIStatus.value = 'dead'
      })

      return {
        toggleDarkMode,
        theme,
        APIStatus,
        text
      }
    },
}
</script>

<style>
.spinner-border {
    border-right: .25em solid transparent;
}
</style>