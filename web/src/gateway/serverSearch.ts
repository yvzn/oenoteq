import { apiClient } from '../api/client'
import type { WineSearchResult } from '../api/types'
import { filtersToQueryParams, type SearchFilters } from '../domain/searchFilters'
import { sortToQueryParams, type WineSort } from '../domain/wineSort'

// The cellar list always reads the server's search; both adapters share it.
export function serverSearch(filters: SearchFilters, sort: WineSort): Promise<WineSearchResult[]> {
  const query = new URLSearchParams({
    ...filtersToQueryParams(filters),
    ...sortToQueryParams(sort),
  }).toString()
  return apiClient.get<WineSearchResult[]>(query ? `/search?${query}` : '/search')
}
