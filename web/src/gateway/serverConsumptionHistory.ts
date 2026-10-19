import { apiClient } from '../api/client'
import type { ConsumptionHistoryEntry } from '../api/types'

// The server's Consumption History: what both adapters serve the history page
// from. The local store holds Consumptions only inside each pulled Wine's
// detail copy, so it can't answer this — the page is online-only.
export function serverConsumptionHistory(): Promise<ConsumptionHistoryEntry[]> {
  return apiClient.get<ConsumptionHistoryEntry[]>('/consumptions')
}
