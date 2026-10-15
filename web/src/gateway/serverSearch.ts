import { apiClient } from '../api/client'
import type { WineSearchResult } from '../api/types'
import { filtersToQueryParams, type SearchFilters } from '../domain/searchFilters'
import { sortToQueryParams, type WineSort } from '../domain/wineSort'

// The server's search: what the direct adapter serves the cellar list from.
export function serverSearch(filters: SearchFilters, sort: WineSort): Promise<WineSearchResult[]> {
  const query = new URLSearchParams({
    ...filtersToQueryParams(filters),
    ...sortToQueryParams(sort),
  }).toString()
  return apiClient.get<WineSearchResult[]>(query ? `/search?${query}` : '/search')
}
