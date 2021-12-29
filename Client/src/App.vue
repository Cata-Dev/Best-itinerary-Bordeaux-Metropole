<script setup>
import Footer from './components/Footer.vue'
</script>

<template>
  <div
    class="
      flex
      flex-col
      h-screen
      w-screen
      justify-between"
  >
    <main
      class="
        mb-auto
        bg-gradient-to-r
        from-blue-800
        to-indigo-400
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