import { ApiError, apiClient } from '../api/client'
import type { Consumption, Wine } from '../api/types'
import { db } from '../db/localDb'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface ConsumptionBody {
  date: string
  rating: number | null
  notes: string | null
  client_id?: string
}

export interface QuantityAdjustmentPayload {
  delta: number
  client_id: string
}

interface ConsumptionCreatePayload {
  wineId: number
  body: ConsumptionBody
}

// A wine created offline only gets its real id once its own create syncs
// (see wineSync.ts). FIFO replay order guarantees the wine's own create has
// already been attempted by the time a dependent item here runs — but if
// that create itself only got as far as "pending" (a retryable connectivity
// error abandons the rest of that pass), the remap won't exist yet either;
// that's just as transient as the network error that caused it, so it's
// retried the same way rather than failed permanently.
async function resolveSyncedWineId(id: number): Promise<number> {
  if (id >= 0) return id
  const remap = await db.idRemap.get(id)
  if (!remap) throw new RetryableOutboxError("This wine hasn't synced yet")
  return remap.serverId
}

async function replaceLocalConsumption(wineId: number, localId: number, created: Consumption): Promise<void> {
  const wine = await db.wines.get(wineId)
  if (!wine) return
  const history = wine.consumption_history.map((c) => (c.id === localId ? created : c))
  await db.wines.update(wineId, { consumption_history: history })
}

// A network error (status 0) never reached the server, so it's not a
// rejection of this item — just try again on the next reconnect.
function rethrowNetworkErrorsAsRetryable(e: unknown): never {
  if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
  throw e
}

const consumptionHandler: OutboxHandler = async (item) => {
  try {
    if (item.action === 'create') {
      const { wineId, body } = item.payload as ConsumptionCreatePayload
      const resolvedWineId = await resolveSyncedWineId(wineId)
      const created = await apiClient.post<Consumption>(`/wines/${resolvedWineId}/consumptions`, body)
      await replaceLocalConsumption(resolvedWineId, item.targetId as number, created)
      return
    }
    await apiClient.put<Consumption>(`/consumptions/${item.targetId}`, item.payload)
  } catch (e) {
    rethrowNetworkErrorsAsRetryable(e)
  }
}

const quantityAdjustmentHandler: OutboxHandler = async (item) => {
  try {
    const resolvedWineId = await resolveSyncedWineId(item.targetId as number)
    const wine = await apiClient.post<Wine>(`/wines/${resolvedWineId}/quantity-adjustments`, item.payload)
    await db.wines.update(resolvedWineId, { quantity: wine.quantity })
  } catch (e) {
    rethrowNetworkErrorsAsRetryable(e)
  }
}

export function enqueueConsumptionCreate(localId: number, wineId: number, body: ConsumptionBody): Promise<number> {
  return enqueue(db.outbox, { entity: 'consumption', action: 'create', targetId: localId, payload: { wineId, body } })
}

export function enqueueConsumptionUpdate(id: number, body: ConsumptionBody): Promise<number> {
  return enqueue(db.outbox, { entity: 'consumption', action: 'update', targetId: id, payload: body })
}

export function enqueueQuantityAdjustment(wineId: number, payload: QuantityAdjustmentPayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'quantity_adjustment', action: 'create', targetId: wineId, payload })
}

// A consumption recorded offline against a wine whose own create hasn't
// synced doesn't have a server id yet, so an edit made before that create
// has synced patches the still-pending create payload in place.
export async function patchPendingConsumptionCreate(localId: number, body: ConsumptionBody): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('consumption')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  const current = pending.payload as ConsumptionCreatePayload
  await db.outbox.update(pending.id!, { payload: { ...current, body: { ...current.body, ...body } } })
  return true
}

// Canceling a consumption still sitting unsent in the outbox just dequeues
// it — nothing was ever pushed, so there's no server call to make.
export async function cancelPendingConsumptionCreate(localId: number): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('consumption')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  await db.outbox.delete(pending.id!)
  return true
}

export async function pushConsumptions(): Promise<void> {
  await replay(db.outbox, { consumption: consumptionHandler, quantity_adjustment: quantityAdjustmentHandler })
}
