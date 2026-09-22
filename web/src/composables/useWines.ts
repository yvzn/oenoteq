import { ref } from 'vue'
import { apiClient, ApiError } from '../api/client'
import type { Consumption, WineDetail } from '../api/types'

export interface ConsumptionInput {
  date: string
  rating: number | null
  notes: string | null
}

export function useWines() {
  const wine = ref<WineDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const submittingConsumption = ref(false)
  const consumptionError = ref<string | null>(null)

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

  async function recordConsumption(id: number, input: ConsumptionInput) {
    submittingConsumption.value = true
    consumptionError.value = null
    try {
      await apiClient.post<Consumption>(`/wines/${id}/consumptions`, input)
      await load(id)
    } catch (e) {
      consumptionError.value = e instanceof ApiError ? e.message : 'Unknown error'
    } finally {
      submittingConsumption.value = false
    }
  }

  return {
    wine,
    loading,
    error,
    load,
    recordConsumption,
    submittingConsumption,
    consumptionError,
  }
}
