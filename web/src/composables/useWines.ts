import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Consumption, Wine, WineDetail, WineInput } from '../api/types'

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
  const updatingConsumption = ref(false)
  const updateConsumptionError = ref<string | null>(null)
  const deletingConsumption = ref(false)
  const deleteConsumptionError = ref<string | null>(null)
  const submitting = ref(false)
  const submitError = ref<string | null>(null)

  async function load(id: number) {
    loading.value = true
    error.value = null
    try {
      wine.value = await apiClient.get<WineDetail>(`/wines/${id}`)
    } catch (e) {
      error.value = friendlyErrorMessage(e)
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
      consumptionError.value = friendlyErrorMessage(e)
    } finally {
      submittingConsumption.value = false
    }
  }

  async function updateConsumption(
    wineId: number,
    consumptionId: number,
    input: ConsumptionInput,
  ): Promise<boolean> {
    updatingConsumption.value = true
    updateConsumptionError.value = null
    try {
      await apiClient.put<Consumption>(`/consumptions/${consumptionId}`, input)
      await load(wineId)
      return true
    } catch (e) {
      updateConsumptionError.value = friendlyErrorMessage(e)
      return false
    } finally {
      updatingConsumption.value = false
    }
  }

  async function deleteConsumption(wineId: number, consumptionId: number): Promise<boolean> {
    deletingConsumption.value = true
    deleteConsumptionError.value = null
    try {
      await apiClient.delete(`/consumptions/${consumptionId}`, undefined)
      await load(wineId)
      return true
    } catch (e) {
      deleteConsumptionError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deletingConsumption.value = false
    }
  }

  async function create(input: WineInput): Promise<Wine | null> {
    submitting.value = true
    submitError.value = null
    try {
      return await apiClient.post<Wine>('/wines', input)
    } catch (e) {
      submitError.value = friendlyErrorMessage(e)
      return null
    } finally {
      submitting.value = false
    }
  }

  async function update(id: number, input: WineInput): Promise<Wine | null> {
    submitting.value = true
    submitError.value = null
    try {
      return await apiClient.put<Wine>(`/wines/${id}`, input)
    } catch (e) {
      submitError.value = friendlyErrorMessage(e)
      return null
    } finally {
      submitting.value = false
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
    updateConsumption,
    updatingConsumption,
    updateConsumptionError,
    deleteConsumption,
    deletingConsumption,
    deleteConsumptionError,
    create,
    update,
    submitting,
    submitError,
  }
}
