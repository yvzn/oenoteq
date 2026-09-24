import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Appellation } from '../api/types'

export function useAppellations() {
  const appellations = ref<Appellation[]>([])
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
      appellations.value = await apiClient.get<Appellation[]>('/appellations')
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Appellation | null> {
    creating.value = true
    createError.value = null
    try {
      const appellation = await apiClient.post<Appellation>('/appellations', { name })
      appellations.value = [...appellations.value, appellation]
      return appellation
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  async function update(id: number, name: string): Promise<Appellation | null> {
    updating.value = true
    updateError.value = null
    try {
      const appellation = await apiClient.put<Appellation>(`/appellations/${id}`, { name })
      appellations.value = appellations.value.map((a) => (a.id === id ? appellation : a))
      return appellation
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
      await apiClient.delete(`/appellations/${id}`, undefined)
      appellations.value = appellations.value.filter((a) => a.id !== id)
      return true
    } catch (e) {
      deleteError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    appellations,
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
