import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { Appellation } from '../api/types'

export function useAppellations() {
  const appellations = ref<Appellation[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      appellations.value = await apiClient.get<Appellation[]>('/appellations')
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Unknown error'
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
      createError.value = e instanceof ApiError ? e.message : 'Unknown error'
      return null
    } finally {
      creating.value = false
    }
  }

  return { appellations, loading, error, load, create, creating, createError }
}
