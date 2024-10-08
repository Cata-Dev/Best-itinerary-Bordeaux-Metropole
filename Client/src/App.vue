<script setup lang="ts">
import FooterBar from "@/components/FooterBar.vue";
import { theme } from "@/store/";

//Sets the real window's height (for mobile browsers like chrome or safari)
let wh = window.innerHeight;

function setVh(height: number) {
  const vh = height * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

setVh(wh);

window.onresize = () => {
  const nWh = window.innerHeight;
  if (wh != nWh) {
    wh = nWh;
    setVh(nWh);
  }
};
</script>

<template>
  <div id="mainWrapper" class="flex flex-col w-screen h-real-screen justify-between">
    <main
      class="mb-auto bg-gradient-to-r bg-size-200 bg-pos-0 dark:bg-pos-100 transition-all duration-200 from-blue-400 via-indigo-500 to-blue-800 h-full overflow-x-auto"
      :class="{ dark: theme === 'dark' }"
    >
      <router-view />
    </main>
    <footer class="bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary">
      <FooterBar />
    </footer>
  </div>
</template>

<style scoped>
.h-real-screen {
  height: 100vh;
  /* Fallback for browsers that do not support Custom Properties */
  height: calc(var(--vh, 1vh) * 100);
}

@tailwind base;

@layer base {
  /* Width */
  ::-webkit-scrollbar {
    width: 10px;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    @apply bg-bg-light;
  }

  .dark::-webkit-scrollbar-track {
    @apply bg-bg-dark;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    @apply bg-bg-light-contrasted;
    @apply rounded-md;
  }

  .dark::-webkit-scrollbar-thumb {
    @apply bg-bg-dark-contrasted;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-bg-light-overcontrasted;
  }

  .dark::-webkit-scrollbar-thumb:hover {
    @apply bg-bg-dark-overcontrasted;
  }
}
</style>
