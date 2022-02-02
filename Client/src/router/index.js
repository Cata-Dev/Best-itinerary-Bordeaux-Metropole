import { createRouter, createWebHistory } from 'vue-router'
import Search from '../views/Search.vue'
const DEFAULT_TITLE = "Best itinerary - BM"

const routes = [
  {
    path: '/',
    name: 'Search',
    component: Search
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.afterEach((to) => {
  document.title = Object.keys(to.params).length === 0 ? DEFAULT_TITLE : `${DEFAULT_TITLE} | ${to.name}`;
});

export {
  router,
}