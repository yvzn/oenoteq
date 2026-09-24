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

  return { producers, loading, error, load, create, creating, createError }
}
