import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Meal } from '../api/types'

export function useMeals() {
  const meals = ref<Meal[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      meals.value = await apiClient.get<Meal[]>('/meals')
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Meal | null> {
    creating.value = true
    createError.value = null
    try {
      const meal = await apiClient.post<Meal>('/meals', { name })
      meals.value = [...meals.value, meal]
      return meal
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  return { meals, loading, error, load, create, creating, createError }
}
