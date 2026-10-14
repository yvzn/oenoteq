import { ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Color, Meal } from '../api/types'
import { sortByName } from '../db/sortByName'
import { gateway } from '../gateway'

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
      meals.value = await gateway.mealPairings.list(appellationId, color)
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
      const meal = await gateway.mealPairings.add(appellationId, color, mealId)
      if (meal) meals.value = sortByName([...meals.value, meal])
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
      await gateway.mealPairings.remove(appellationId, color, mealId)
      meals.value = meals.value.filter((m) => m.id !== mealId)
    } catch (e) {
      mutateError.value = friendlyErrorMessage(e)
    } finally {
      mutating.value = false
    }
  }

  return { meals, loading, error, load, add, remove, mutating, mutateError }
}
