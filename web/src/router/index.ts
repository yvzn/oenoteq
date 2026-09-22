import { createRouter, createWebHistory } from 'vue-router'
import CellarListView from '../views/CellarListView.vue'
import WineDetailView from '../views/WineDetailView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'cellar', component: CellarListView },
    { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
  ],
})

export default router
