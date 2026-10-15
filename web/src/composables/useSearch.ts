import { onScopeDispose, ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { WineSearchResult } from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import type { WineSort } from '../domain/wineSort'
import { gateway } from '../gateway'

// Subscribes to the cellar for the given filters and sort, replacing any
// earlier subscription. Results keep arriving for as long as the gateway has
// something new to say (e.g. a local write), until the scope is disposed.
export function useSearch() {
  const results = ref<WineSearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  function stop() {
    unsubscribe?.()
    unsubscribe = null
  }

  function search(filters: SearchFilters, sort: WineSort) {
    stop()
    loading.value = true
    error.value = null
    unsubscribe = gateway.watchSearch(
      filters,
      sort,
      (next) => {
        results.value = next
        error.value = null
        loading.value = false
      },
      (e) => {
        error.value = friendlyErrorMessage(e)
        loading.value = false
      },
    )
  }

  onScopeDispose(stop)

  return { results, loading, error, search }
}
