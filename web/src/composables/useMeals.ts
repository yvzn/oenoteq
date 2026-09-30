import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Meal } from '../api/types'
import { db } from '../db/localDb'
import { nextLocalId } from '../db/localId'
import { pushChangesInBackground } from '../sync'
import { enqueueMealCreate, enqueueMealUpdate, patchPendingMealCreate, pullMeals } from '../sync/mealSync'

export function useMeals() {
  const meals = ref<Meal[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)
  const updating = ref(false)
  const updateError = ref<string | null>(null)
  const deleting = ref(false)
  const deleteError = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      if (navigator.onLine !== false) await pullMeals()
      meals.value = await db.meals.toArray()
    } catch (e) {
      const cached = await db.meals.toArray()
      if (cached.length > 0) {
        meals.value = cached
      } else {
        error.value = friendlyErrorMessage(e)
      }
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Meal | null> {
    creating.value = true
    createError.value = null
    try {
      const localId = nextLocalId()
      const record: Meal = { id: localId, name }
      await db.meals.put(record)
      meals.value = [...meals.value, record]
      await enqueueMealCreate(localId, { name, client_id: crypto.randomUUID() })
      pushChangesInBackground()
      return record
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  async function update(id: number, name: string): Promise<Meal | null> {
    updating.value = true
    updateError.value = null
    try {
      const record: Meal = { id, name }
      await db.meals.put(record)
      meals.value = meals.value.map((m) => (m.id === id ? record : m))

      const patchedPendingCreate = id < 0 && (await patchPendingMealCreate(id, { name }))
      if (!patchedPendingCreate) await enqueueMealUpdate(id, { name })
      pushChangesInBackground()
      return record
    } catch (e) {
      updateError.value = friendlyErrorMessage(e)
      return null
    } finally {
      updating.value = false
    }
  }

  async function remove(id: number): Promise<boolean> {
    deleting.value = true
    deleteError.value = null
    try {
      await apiClient.delete(`/meals/${id}`, undefined)
      meals.value = meals.value.filter((m) => m.id !== id)
      await db.meals.delete(id)
      return true
    } catch (e) {
      deleteError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    meals,
    loading,
    error,
    load,
    create,
    creating,
    createError,
    update,
    updating,
    updateError,
    remove,
    deleting,
    deleteError,
  }
}
