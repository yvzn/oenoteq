import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Producer } from '../api/types'

export function useProducers() {
  const producers = ref<Producer[]>([])
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
      producers.value = await apiClient.get<Producer[]>('/producers')
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Producer | null> {
    creating.value = true
    createError.value = null
    try {
      const producer = await apiClient.post<Producer>('/producers', { name })
      producers.value = [...producers.value, producer]
      return producer
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  async function update(id: number, name: string): Promise<Producer | null> {
    updating.value = true
    updateError.value = null
    try {
      const producer = await apiClient.put<Producer>(`/producers/${id}`, { name })
      producers.value = producers.value.map((p) => (p.id === id ? producer : p))
      return producer
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
      await apiClient.delete(`/producers/${id}`, undefined)
      producers.value = producers.value.filter((p) => p.id !== id)
      return true
    } catch (e) {
      deleteError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    producers,
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
