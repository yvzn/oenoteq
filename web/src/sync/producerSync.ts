import { ApiError, apiClient } from '../api/client'
import type { Producer } from '../api/types'
import { db } from '../db/localDb'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface ProducerPayload {
  name: string
}

export interface ProducerCreatePayload extends ProducerPayload {
  client_id: string
}

const producerHandler: OutboxHandler = async (item) => {
  try {
    if (item.action === 'create') {
      const created = await apiClient.post<Producer>('/producers', item.payload)
      const localId = item.targetId as number
      await db.transaction('rw', db.producers, db.wines, db.idRemap, async () => {
        await db.producers.delete(localId)
        await db.producers.put(created)
        // Wines saved against the local id would otherwise be left pointing
        // at (and embedding) a producer that no longer exists locally.
        await db.wines
          .filter((wine) => wine.producer_id === localId)
          .modify({ producer_id: created.id, producer: created })
        await db.idRemap.put({ localId, serverId: created.id })
      })
      return
    }
    await apiClient.put<Producer>(`/producers/${item.targetId}`, item.payload)
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
    throw e
  }
}

export function enqueueProducerCreate(localId: number, payload: ProducerCreatePayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: localId, payload })
}

export function enqueueProducerUpdate(id: number, payload: ProducerPayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'producer', action: 'update', targetId: id, payload })
}

// A producer created offline doesn't have a server id yet, so an edit made
// before that create has synced patches the still-pending create payload
// in place instead of queuing an update against an id that doesn't exist yet.
export async function patchPendingProducerCreate(localId: number, payload: ProducerPayload): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('producer')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  await db.outbox.update(pending.id!, { payload: { ...(pending.payload as object), ...payload } })
  return true
}

export async function pushProducers(): Promise<void> {
  await replay(db.outbox, { producer: producerHandler })
}

// Full replication of the current server Producer state. Dataset is
// personal-cellar scale, so a full replace each pull stays simple.
export async function pullProducers(): Promise<void> {
  const producers = await apiClient.get<Producer[]>('/producers')
  await db.producers.bulkPut(producers)
  const serverIds = new Set(producers.map((p) => p.id))
  const local = await db.producers.toArray()
  for (const p of local) {
    if (p.id > 0 && !serverIds.has(p.id)) await db.producers.delete(p.id)
  }
}
