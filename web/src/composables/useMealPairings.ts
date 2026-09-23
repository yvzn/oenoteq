import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Color, Meal } from '../api/types'

export function useMealPairings() {
  const meals = ref<Meal[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const mutating = ref(false)
  const mutateError = ref<string | null>(null)

  async function load(appellationId: number, color: Color) {
    loading.value = true
    error.value = null
    try {
      meals.value = await apiClient.get<Meal[]>(
        `/meal-pairings?appellation_id=${appellationId}&color=${color}`,
      )
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function add(appellationId: number, color: Color, mealId: number) {
    mutating.value = true
    mutateError.value = null
    try {
      await apiClient.post('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
      await load(appellationId, color)
    } catch (e) {
      mutateError.value = friendlyErrorMessage(e)
    } finally {
      mutating.value = false
    }
  }

  async function remove(appellationId: number, color: Color, mealId: number) {
    mutating.value = true
    mutateError.value = null
    try {
      await apiClient.delete('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
      await load(appellationId, color)
    } catch (e) {
      mutateError.value = friendlyErrorMessage(e)
    } finally {
      mutating.value = false
    }
  }

  return { meals, loading, error, load, add, remove, mutating, mutateError }
}
