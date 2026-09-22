import { createRouter, createWebHistory } from 'vue-router'
import CellarListView from '../views/CellarListView.vue'
import MealPairingView from '../views/MealPairingView.vue'
import WineDetailView from '../views/WineDetailView.vue'
import WineFormView from '../views/WineFormView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'cellar', component: CellarListView },
    { path: '/wines/new', name: 'wine-new', component: WineFormView },
    { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
    { path: '/wines/:id/edit', name: 'wine-edit', component: WineFormView },
    { path: '/meal-pairings', name: 'meal-pairings', component: MealPairingView },
  ],
})

export default router
