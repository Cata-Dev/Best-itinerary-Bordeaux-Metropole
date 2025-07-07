<script setup lang="ts">
import FooterBar from "@/components/FooterBar.vue";
import { theme } from "./store";

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
      class="mb-auto bg-linear-to-r bg-size-[200%] bg-position-[0%] dark:bg-position-[100%] transition-colors transition-discrete duration-darkmode from-blue-400 via-indigo-500 to-blue-800 h-full overflow-x-auto"
      :class="{ dark: theme === 'dark' }"
    >
      <router-view />
    </main>
    <footer
      class="transition-colors duration-darkmode bg-bg-light dark:bg-bg-dark text-text-light-primary dark:text-text-dark-primary"
    >
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
</style>
