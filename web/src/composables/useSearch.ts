import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { WineSearchResult } from '../api/types'
import { filtersToQueryParams, type SearchFilters } from '../domain/searchFilters'

export function useSearch() {
  const results = ref<WineSearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function search(filters: SearchFilters) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams(filtersToQueryParams(filters)).toString()
      results.value = await apiClient.get<WineSearchResult[]>(query ? `/search?${query}` : '/search')
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return { results, loading, error, search }
}
