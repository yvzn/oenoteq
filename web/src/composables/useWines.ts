import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Consumption, Producer, Wine, WineCreateInput, WineDetail, WineInput } from '../api/types'
import { db } from '../db/localDb'
import { enqueueWineCreate, enqueueWineUpdate, patchPendingWineCreate, pullWine, pushWines } from '../sync/wineSync'

export interface ConsumptionInput {
  date: string
  rating: number | null
  notes: string | null
}

let localIdSeq = 0
// Offline-created wines get a negative, client-only id until the create
// syncs and the record is replaced by the server-assigned one.
function nextLocalId(): number {
  localIdSeq += 1
  return -(Date.now() * 1000 + localIdSeq)
}

function pushWinesInBackground(): void {
  if (navigator.onLine === false) return
  pushWines().catch(() => {})
}

function buildWineDetail(
  id: number,
  input: WineInput,
  producer: Producer,
  extras: Pick<WineDetail, 'quantity' | 'suggested_meals' | 'consumption_history'>,
): WineDetail {
  return {
    id,
    millesime: input.millesime,
    appellation_id: input.appellation_id,
    producer_id: input.producer_id,
    producer,
    color: input.color,
    garde_debut: input.garde_debut,
    garde_fin: input.garde_fin,
    ...extras,
  }
}

async function resolveProducer(existing: WineDetail | undefined, producerId: number): Promise<Producer> {
  if (existing && existing.producer_id === producerId) return existing.producer
  return (await db.producers.get(producerId)) ?? { id: producerId, name: '' }
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

  // Returns the id the wine actually ended up loaded under — a negative id
  // whose create has since synced resolves to its real server id.
  async function load(id: number): Promise<number> {
    loading.value = true
    error.value = null
    let resolvedId = id
    let cached = await db.wines.get(id)
    // A negative id is local-only. If it's still in the local store, its
    // create hasn't synced yet and it can never exist at the server (see
    // the id < 0 branch below). If it's gone, its create may have already
    // synced and replaced it — check the breadcrumb left behind for that.
    if (!cached && id < 0) {
      const remap = await db.idRemap.get(id)
      if (remap) {
        resolvedId = remap.serverId
        cached = await db.wines.get(resolvedId)
      }
    }
    if (cached) wine.value = cached
    if (resolvedId < 0) {
      loading.value = false
      return resolvedId
    }
    try {
      if (navigator.onLine !== false) {
        wine.value = await pullWine(resolvedId)
      }
    } catch (e) {
      if (!cached) error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
    return resolvedId
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

  async function create(input: WineCreateInput): Promise<Wine | null> {
    submitting.value = true
    submitError.value = null
    try {
      const producer = await resolveProducer(undefined, input.producer_id)
      const localId = nextLocalId()
      const record = buildWineDetail(localId, input, producer, {
        quantity: input.initial_quantity,
        suggested_meals: [],
        consumption_history: [],
      })
      await db.wines.put(record)
      await enqueueWineCreate(localId, { ...input, client_id: crypto.randomUUID() })
      pushWinesInBackground()
      return record
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
      let targetId = id
      let existing = await db.wines.get(id)
      // Defense in depth: the view layer redirects a stale negative id once
      // it notices load() resolved elsewhere, but if an update is somehow
      // submitted against a stale id anyway (a tight race), redirect it here
      // too rather than queuing a PUT against an id that no longer exists.
      if (!existing && id < 0) {
        const remap = await db.idRemap.get(id)
        if (remap) {
          targetId = remap.serverId
          existing = await db.wines.get(targetId)
        }
      }
      const producer = await resolveProducer(existing, input.producer_id)
      const merged = buildWineDetail(targetId, input, producer, {
        quantity: existing?.quantity ?? 0,
        suggested_meals: existing?.suggested_meals ?? [],
        consumption_history: existing?.consumption_history ?? [],
      })
      await db.wines.put(merged)

      const patchedPendingCreate = targetId < 0 && (await patchPendingWineCreate(targetId, input))
      if (!patchedPendingCreate) await enqueueWineUpdate(targetId, input)
      pushWinesInBackground()
      return merged
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
