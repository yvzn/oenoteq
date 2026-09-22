import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { Meal } from '../api/types'

export function useMeals() {
  const meals = ref<Meal[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      meals.value = await apiClient.get<Meal[]>('/meals')
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { meals, loading, error, load }
}
