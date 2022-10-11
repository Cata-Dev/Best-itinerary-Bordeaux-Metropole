import { createRouter, createWebHistory } from "vue-router";
import SearchView from "../views/SearchView.vue";
const DEFAULT_TITLE = "Best itinerary - BM";

const routes = [
  {
    path: "/",
    name: "Search",
    component: SearchView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.afterEach((to) => {
  document.title =
    Object.keys(to.params).length === 0 ? DEFAULT_TITLE : `${DEFAULT_TITLE} | ${String(to.name)}`;
});

export { router };
