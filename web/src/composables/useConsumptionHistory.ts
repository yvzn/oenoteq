import { ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { ConsumptionHistoryEntry } from '../api/types'
import { gateway } from '../gateway'

// Online-only, in both consent modes: a failure leaves nothing to show.
export function useConsumptionHistory() {
  const entries = ref<ConsumptionHistoryEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      entries.value = await gateway.consumptionHistory()
    } catch (e) {
      entries.value = []
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { entries, loading, error, load }
}
