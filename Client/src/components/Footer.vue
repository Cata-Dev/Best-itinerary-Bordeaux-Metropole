<template>
  <div class="grid grid-cols-3 gap-3 justify-center content-center">
    <p
      class="
      col-start-2
      my-auto
      text-center
      text-sm
      text-t-light-faded
      dark:text-t-dark-faded"
    >
      Trouver le meilleur itinéraire sur Bordeaux Métropole © 2021
    </p>
    <button
      class="flex justify-self-end self-center my-1 mr-4"
      @click="toggleDarkMode"
    >
      <font-awesome-icon
        :icon="theme === 'light' ? 'moon' : 'sun'"
        class=""
        style="font-size: 20px;"
      />
    </button>
  </div>
</template>

<script>
import { toggleDarkMode, theme } from '../store'

export default {
    name: 'FooterBar',
    setup() {

      return {
        toggleDarkMode,
        theme
      }
    },
}
</script>