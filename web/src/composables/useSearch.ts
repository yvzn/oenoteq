import { ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { WineSearchResult } from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import type { WineSort } from '../domain/wineSort'
import { gateway } from '../gateway'

export function useSearch() {
  const results = ref<WineSearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function search(filters: SearchFilters, sort: WineSort) {
    loading.value = true
    error.value = null
    try {
      results.value = await gateway.search(filters, sort)
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { results, loading, error, search }
}
