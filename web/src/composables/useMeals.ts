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
  const updating = ref(false)
  const updateError = ref<string | null>(null)
  const deleting = ref(false)
  const deleteError = ref<string | null>(null)

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

  async function update(id: number, name: string): Promise<Meal | null> {
    updating.value = true
    updateError.value = null
    try {
      const meal = await apiClient.put<Meal>(`/meals/${id}`, { name })
      meals.value = meals.value.map((m) => (m.id === id ? meal : m))
      return meal
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
