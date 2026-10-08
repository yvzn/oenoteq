import { ApiError, apiClient } from '../api/client'
import type { Meal } from '../api/types'
import { db } from '../db/localDb'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface MealPayload {
  name: string
}

export interface MealCreatePayload extends MealPayload {
  client_id: string
}

const mealHandler: OutboxHandler = async (item) => {
  try {
    if (item.action === 'create') {
      const created = await apiClient.post<Meal>('/meals', item.payload)
      const localId = item.targetId as number
      await db.transaction('rw', db.meals, db.idRemap, async () => {
        await db.meals.delete(localId)
        await db.meals.put(created)
        await db.idRemap.put({ localId, serverId: created.id })
      })
      return
    }
    await apiClient.put<Meal>(`/meals/${item.targetId}`, item.payload)
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
    throw e
  }
}

export function enqueueMealCreate(localId: number, payload: MealCreatePayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: localId, payload })
}

export function enqueueMealUpdate(id: number, payload: MealPayload): Promise<number> {
  return enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: id, payload })
}

// A meal created offline doesn't have a server id yet, so an edit made
// before that create has synced patches the still-pending create payload
// in place instead of queuing an update against an id that doesn't exist yet.
export async function patchPendingMealCreate(localId: number, payload: MealPayload): Promise<boolean> {
  const pending = await db.outbox
    .where('entity')
    .equals('meal')
    .filter((item) => item.action === 'create' && item.targetId === localId)
    .first()
  if (!pending) return false
  await db.outbox.update(pending.id!, { payload: { ...(pending.payload as object), ...payload } })
  return true
}

export async function pushMeals(): Promise<void> {
  await replay(db.outbox, { meal: mealHandler })
}

// Full replication of the current server Meal state. Dataset is
// personal-cellar scale, so a full replace each pull stays simple.
export async function pullMeals(): Promise<void> {
  const meals = await apiClient.get<Meal[]>('/meals')
  await db.meals.bulkPut(meals)
  const serverIds = new Set(meals.map((m) => m.id))
  const local = await db.meals.toArray()
  for (const m of local) {
    if (m.id > 0 && !serverIds.has(m.id)) await db.meals.delete(m.id)
  }
}
