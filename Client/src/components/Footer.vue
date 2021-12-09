<template>
  <div class="grid grid-cols-3 gap-3 justify-center content-center">
    <div></div>
    <p class="my-auto text-center text-t-light-faded dark:text-t-dark-faded">Trouver le meilleur itinéraire sur Bordeaux Métropole © 2021</p>
    <button class="justify-self-end my-2 mr-4" @click="toggleDarkMode">
        <font-awesome-icon :icon="theme === 'light' ? 'moon' : 'sun'" class="align-self-center " style="font-size: 24px;"/>
    </button>
  </div>
</template>

<script>
import { toggleDarkMode, theme } from '../store'

export default {
    name: 'Footer',
    setup() {

      return {
        toggleDarkMode,
        theme
      }
    },
}
</script>