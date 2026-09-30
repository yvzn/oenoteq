import { ApiError, apiClient } from '../api/client'
import type { Appellation } from '../api/types'
import { db } from '../db/localDb'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface AppellationPayload {
  name: string
}

export interface AppellationCreatePayload extends AppellationPayload {
  client_id: string
}

const appellationHandler: OutboxHandler = async (item) => {
  try {
    if (item.action === 'create') {
      const created = await apiClient.post<Appellation>('/appellations', item.payload)
      const localId = item.targetId as number
      await db.transaction('rw', db.appellations, db.idRemap, async () => {
        await db.appellations.delete(localId)
        await db.appellations.put(created)
        await db.idRemap.put({ localId, serverId: created.id })
      })
      return
    }
    await apiClient.put<Appellation>(`/appellations/${item.targetId}`, item.payload)
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
    throw e
  }
}

export function enqueueAppellationCreate(localId: number, payload: AppellationCreatePayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: localId, payload })
}

export function enqueueAppellationUpdate(id: number, payload: AppellationPayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'appellation', action: 'update', targetId: id, payload })
}

// An appellation created offline doesn't have a server id yet, so an edit
// made before that create has synced patches the still-pending create
// payload in place instead of queuing an update against an id that doesn't
// exist yet.
export async function patchPendingAppellationCreate(
  localId: number,
  payload: AppellationPayload,
): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('appellation')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  await db.outbox.update(pending.id!, { payload: { ...(pending.payload as object), ...payload } })
  return true
}

export async function pushAppellations(): Promise<void> {
  await replay(db.outbox, { appellation: appellationHandler })
}

// Full replication of the current server Appellation state. Dataset is
// personal-cellar scale, so a full replace each pull stays simple.
export async function pullAppellations(): Promise<void> {
  const appellations = await apiClient.get<Appellation[]>('/appellations')
  await db.appellations.bulkPut(appellations)
  const serverIds = new Set(appellations.map((a) => a.id))
  const local = await db.appellations.toArray()
  for (const a of local) {
    if (a.id > 0 && !serverIds.has(a.id)) await db.appellations.delete(a.id)
  }
}
