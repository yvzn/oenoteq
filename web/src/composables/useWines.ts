import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { WineDetail } from '../api/types'

export function useWines() {
  const wine = ref<WineDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(id: number) {
    loading.value = true
    error.value = null
    try {
      wine.value = await apiClient.get<WineDetail>(`/wines/${id}`)
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { wine, loading, error, load }
}
