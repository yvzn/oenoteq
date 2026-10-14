import { ref } from 'vue'
import { ApiError } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Wine, WineCreateInput, WineDetail, WineInput } from '../api/types'
import { gateway, type ConsumptionInput } from '../gateway'

export type { ConsumptionInput }

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
  const adjustingQuantity = ref(false)
  const adjustQuantityError = ref<string | null>(null)

  // Returns the id the wine actually ended up loaded under — a negative id
  // whose create has since synced resolves to its real server id.
  async function load(id: number): Promise<number> {
    loading.value = true
    error.value = null
    try {
      const result = await gateway.wines.get(id, (cached) => {
        wine.value = cached
      })
      if (result.wine) wine.value = result.wine
      if (result.error) error.value = friendlyErrorMessage(result.error)
      return result.resolvedId
    } finally {
      loading.value = false
    }
  }

  async function recordConsumption(id: number, input: ConsumptionInput) {
    submittingConsumption.value = true
    consumptionError.value = null
    try {
      wine.value = await gateway.wines.recordConsumption(id, input)
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
      wine.value = await gateway.wines.updateConsumption(wineId, consumptionId, input)
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
      const refreshed = await gateway.wines.deleteConsumption(wineId, consumptionId)
      if (refreshed) wine.value = refreshed
      return true
    } catch (e) {
      // It must have synced in the background between render and this click
      // — refresh rather than guessing at quantity.
      if (e instanceof ApiError && e.message === 'consumption_not_found') await load(wineId)
      deleteConsumptionError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deletingConsumption.value = false
    }
  }

  async function adjustQuantity(id: number, delta: number): Promise<boolean> {
    adjustingQuantity.value = true
    adjustQuantityError.value = null
    try {
      wine.value = await gateway.wines.adjustQuantity(id, delta)
      return true
    } catch (e) {
      adjustQuantityError.value = friendlyErrorMessage(e)
      return false
    } finally {
      adjustingQuantity.value = false
    }
  }

  async function create(input: WineCreateInput): Promise<Wine | null> {
    submitting.value = true
    submitError.value = null
    try {
      return await gateway.wines.create(input)
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
      return await gateway.wines.update(id, input)
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
    adjustQuantity,
    adjustingQuantity,
    adjustQuantityError,
  }
}
