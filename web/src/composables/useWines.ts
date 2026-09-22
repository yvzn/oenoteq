import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { Wine } from '../api/types'

export function useWines() {
  const wines = ref<Wine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      wines.value = await apiClient.get<Wine[]>('/wines')
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { wines, loading, error, load }
}
