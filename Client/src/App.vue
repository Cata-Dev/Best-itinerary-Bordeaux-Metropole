<template>
  <div class="flex flex-col h-screen w-screen justify-between">
    <main class="mb-auto bg-gradient-to-r h-full from-blue-800 to-indigo-400">
      <router-view/>
    </main>
    <footer class="bg-bg-light dark:bg-bg-dark text-t-light-primary dark:text-t-dark-primary">
      <Footer/>
    </footer>
  </div>
</template>

<script>
import Footer from './components/Footer.vue'

export default {
  components: {
    Footer,
  },
  setup() {
    
  },
}
</script>