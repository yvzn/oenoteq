import { createRouter, createWebHistory } from 'vue-router'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import AppellationFormView from '../views/AppellationFormView.vue'
import AppellationListView from '../views/AppellationListView.vue'
import CellarListView from '../views/CellarListView.vue'
import ManageHubView from '../views/ManageHubView.vue'
import MealFormView from '../views/MealFormView.vue'
import MealListView from '../views/MealListView.vue'
import MealPairingView from '../views/MealPairingView.vue'
import ProducerFormView from '../views/ProducerFormView.vue'
import ProducerListView from '../views/ProducerListView.vue'
import SyncStatusView from '../views/SyncStatusView.vue'
import WineDetailView from '../views/WineDetailView.vue'
import WineFormView from '../views/WineFormView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'cellar', component: CellarListView },
    { path: '/wines/new', name: 'wine-new', component: WineFormView },
    { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
    { path: '/wines/:id/edit', name: 'wine-edit', component: WineFormView },
    { path: '/manage', name: 'manage', component: ManageHubView },
    { path: '/meal-pairings', name: 'meal-pairings', component: MealPairingView },
    { path: '/meals', name: 'meals', component: MealListView },
    { path: '/meals/new', name: 'meal-new', component: MealFormView },
    { path: '/meals/:id/edit', name: 'meal-edit', component: MealFormView },
    { path: '/appellations', name: 'appellations', component: AppellationListView },
    { path: '/appellations/new', name: 'appellation-new', component: AppellationFormView },
    { path: '/appellations/:id/edit', name: 'appellation-edit', component: AppellationFormView },
    { path: '/producers', name: 'producers', component: ProducerListView },
    { path: '/producers/new', name: 'producer-new', component: ProducerFormView },
    { path: '/producers/:id/edit', name: 'producer-edit', component: ProducerFormView },
    { path: '/sync-status', name: 'sync-status', component: SyncStatusView },
  ],
})

useSuccessMessage().attachAutoClear(router)

export default router
