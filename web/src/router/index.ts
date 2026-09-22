import { createRouter, createWebHistory } from 'vue-router'
import CellarListView from '../views/CellarListView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'cellar', component: CellarListView }],
})

export default router
