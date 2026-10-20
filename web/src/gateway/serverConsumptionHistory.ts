import { apiClient } from '../api/client'
import type { ConsumptionHistoryEntry } from '../api/types'
import { consumptionHistorySortToQueryParams, type ConsumptionHistorySort } from '../domain/consumptionHistorySort'
import { commonFiltersToQueryParams, type CommonFilters } from '../domain/searchFilters'

// The server's Consumption History: what both adapters serve the history page
// from. The local store holds Consumptions only inside each pulled Wine's
// detail copy, so it can't answer this — the page is online-only.
export function serverConsumptionHistory(
  filters: CommonFilters,
  sort: ConsumptionHistorySort,
): Promise<ConsumptionHistoryEntry[]> {
  const query = new URLSearchParams({
    ...commonFiltersToQueryParams(filters),
    ...consumptionHistorySortToQueryParams(sort),
  }).toString()
  return apiClient.get<ConsumptionHistoryEntry[]>(query ? `/consumptions?${query}` : '/consumptions')
}
