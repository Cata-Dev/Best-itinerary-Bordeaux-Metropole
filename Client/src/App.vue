<script setup>
import Footer from './components/Footer.vue'

//Sets the real window's height (for mobile browsers like chrome or safari)
const vh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--vh', `${vh}px`);
</script>

<template>
  <div
    id="mainWrapper"
    class="
      flex
      flex-col
      w-screen
      h-real-screen
      justify-between"
  >
    <main
      class="
        mb-auto
        bg-gradient-to-r
        bg-size-200
        bg-pos-0
        dark:bg-pos-100
        transition-all
        duration-200
        from-blue-400
        via-indigo-500
        to-blue-800
        h-full
        overflow-x-auto"
    >
      <router-view />
    </main>
    <footer
      class="
        bg-bg-light
        dark:bg-bg-dark
        text-text-light-primary
        dark:text-text-dark-primary"
    >
      <Footer />
    </footer>
  </div>
</template>

<style scoped>
.h-real-screen {
  height: 100vh; /* Fallback for browsers that do not support Custom Properties */
  height: calc(var(--vh, 1vh) * 100);
}
</style>