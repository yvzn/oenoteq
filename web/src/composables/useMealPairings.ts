import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Color, Meal } from '../api/types'
import { db } from '../db/localDb'
import { pushChangesInBackground } from '../sync'
import { enqueueMealPairingAdd, pullMealPairings } from '../sync/mealPairingSync'

async function readLocalPairing(appellationId: number, color: Color): Promise<Meal[]> {
  const records = await db.mealPairings
    .where('appellationId')
    .equals(appellationId)
    .filter((r) => r.color === color)
    .toArray()
  const meals = await Promise.all(records.map((r) => db.meals.get(r.mealId)))
  return meals.filter((m): m is Meal => m !== undefined)
}

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
      if (navigator.onLine !== false) {
        meals.value = await pullMealPairings(appellationId, color)
      } else {
        meals.value = await readLocalPairing(appellationId, color)
      }
    } catch (e) {
      const cached = await readLocalPairing(appellationId, color)
      if (cached.length > 0) {
        meals.value = cached
      } else {
        error.value = friendlyErrorMessage(e)
      }
    } finally {
      loading.value = false
    }
  }

  async function add(appellationId: number, color: Color, mealId: number) {
    mutating.value = true
    mutateError.value = null
    try {
      const meal = await db.meals.get(mealId)
      await db.mealPairings.put({ appellationId, color, mealId })
      if (meal) meals.value = [...meals.value, meal]
      await enqueueMealPairingAdd({ appellationId, color, mealId })
      pushChangesInBackground()
    } catch (e) {
      mutateError.value = friendlyErrorMessage(e)
    } finally {
      mutating.value = false
    }
  }

  // Removal stays synchronous and online-only, unchanged from today — no
  // outbox queueing.
  async function remove(appellationId: number, color: Color, mealId: number) {
    mutating.value = true
    mutateError.value = null
    try {
      await apiClient.delete('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
      await db.mealPairings.delete([appellationId, color, mealId])
      meals.value = meals.value.filter((m) => m.id !== mealId)
    } catch (e) {
      mutateError.value = friendlyErrorMessage(e)
    } finally {
      mutating.value = false
    }
  }

  return { meals, loading, error, load, add, remove, mutating, mutateError }
}
