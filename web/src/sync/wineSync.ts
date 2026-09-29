import { ApiError, apiClient } from '../api/client'
import type { Producer, Wine, WineCreateInput, WineDetail, WineInput } from '../api/types'
import { db } from '../db/localDb'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface WineCreatePayload extends WineCreateInput {
  client_id: string
}

const wineHandler: OutboxHandler = async (item) => {
  try {
    if (item.action === 'create') {
      const created = await apiClient.post<Wine>('/wines', item.payload)
      const localId = item.targetId as number
      // Wrapped in one transaction so a reader can never observe the moment
      // between the old record disappearing and the remap breadcrumb
      // existing to redirect it.
      await db.transaction('rw', db.wines, db.idRemap, async () => {
        await db.wines.delete(localId)
        await db.wines.put({ ...created, suggested_meals: [], consumption_history: [] })
        await db.idRemap.put({ localId, serverId: created.id })
      })
      return
    }
    await apiClient.put<Wine>(`/wines/${item.targetId}`, item.payload)
  } catch (e) {
    // status 0 means the request never reached the server (offline/unreachable
    // home PC per ADR-0002) — that's not a rejection of this item, just try
    // again on the next reconnect.
    if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
    throw e
  }
}

export function enqueueWineCreate(localId: number, payload: WineCreatePayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: localId, payload })
}

export function enqueueWineUpdate(id: number, payload: WineInput): Promise<number> {
  return enqueue(db.outbox, { entity: 'wine', action: 'update', targetId: id, payload })
}

// Local wines created offline don't have a server id yet, so an edit made
// before that create has synced patches the still-pending create payload
// in place instead of queuing an update against a server id that doesn't exist.
export async function patchPendingWineCreate(localId: number, input: WineInput): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('wine')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  await db.outbox.update(pending.id!, { payload: { ...(pending.payload as object), ...input } })
  return true
}

export async function pushWines(): Promise<void> {
  await replay(db.outbox, { wine: wineHandler })
}

export async function pullWine(id: number): Promise<WineDetail> {
  const detail = await apiClient.get<WineDetail>(`/wines/${id}`)
  await db.wines.put(detail)
  return detail
}

// Full replication of the current server Wine (and producer reference) state.
// Dataset is personal-cellar scale, so a full replace each pull stays simple.
export async function pullWines(): Promise<void> {
  const [wines, producers] = await Promise.all([
    apiClient.get<Wine[]>('/wines'),
    apiClient.get<Producer[]>('/producers'),
  ])
  await db.producers.bulkPut(producers)
  for (const wine of wines) {
    const existing = await db.wines.get(wine.id)
    await db.wines.put({
      ...wine,
      suggested_meals: existing?.suggested_meals ?? [],
      consumption_history: existing?.consumption_history ?? [],
    })
  }
  const serverIds = new Set(wines.map((w) => w.id))
  const localWines = await db.wines.toArray()
  for (const local of localWines) {
    if (local.id > 0 && !serverIds.has(local.id)) await db.wines.delete(local.id)
  }
}
