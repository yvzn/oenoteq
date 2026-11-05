import { ApiError, apiClient } from '../api/client'
import type { Color, Meal } from '../api/types'
import { db } from '../db/localDb'
import { resolveSyncedId } from './idRemap'
import { enqueue, replay, RetryableOutboxError, type OutboxHandler } from './outbox'

export interface MealPairingAddPayload {
  appellationId: number
  color: Color
  mealId: number
}

const mealPairingHandler: OutboxHandler = async (item) => {
  const { appellationId, color, mealId } = item.payload as MealPairingAddPayload
  try {
    const resolvedAppellationId = await resolveSyncedId(appellationId)
    const resolvedMealId = await resolveSyncedId(mealId)
    await apiClient.post('/meal-pairings', {
      appellation_id: resolvedAppellationId,
      color,
      meal_id: resolvedMealId,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) throw new RetryableOutboxError(e.message)
    throw e
  }
}

// No client_id needed here — the composite (appellation_id, color, meal_id)
// key already makes the backend's INSERT OR IGNORE naturally idempotent on
// a retried push.
export function enqueueMealPairingAdd(payload: MealPairingAddPayload): Promise<number> {
  return enqueue(db.outbox, {
    entity: 'meal_pairing',
    action: 'create',
    targetId: `${payload.appellationId}:${payload.color}:${payload.mealId}`,
    payload,
  })
}

export async function pushMealPairings(): Promise<void> {
  await replay(db.outbox, { meal_pairing: mealPairingHandler })
}

// Fetches and caches the current server pairing list for one
// appellation+color, for the per-combination pairing view.
export async function pullMealPairings(appellationId: number, color: Color): Promise<Meal[]> {
  const meals = await apiClient.get<Meal[]>(`/meal-pairings?appellation_id=${appellationId}&color=${color}`)
  await db.mealPairings
    .where('appellationId')
    .equals(appellationId)
    .filter((r) => r.color === color)
    .delete()
  await db.mealPairings.bulkPut(meals.map((meal) => ({ appellationId, color, mealId: meal.id })))
  await db.meals.bulkPut(meals)
  return meals
}

interface ServerMealPairing {
  appellation_id: number
  color: Color
  meal_id: number
}

// Full replication of every server pairing edge, so the meal filter works
// offline for any appellation+color. An edge with an unsent add in the outbox
// is kept even though the server doesn't list it yet. Removes are online-only
// (ADR 0006), so there is never a pending remove to protect.
export async function pullAllMealPairings(): Promise<void> {
  const edges = await apiClient.get<ServerMealPairing[]>('/meal-pairings/all')
  const key = (a: number, c: Color, m: number) => `${a}:${c}:${m}`
  const serverKeys = new Set(edges.map((e) => key(e.appellation_id, e.color, e.meal_id)))

  await db.transaction('rw', db.mealPairings, db.outbox, async () => {
    // Read inside the transaction so an add enqueued during the fetch is seen.
    const pendingKeys = new Set(
      (await db.outbox.where('entity').equals('meal_pairing').toArray()).map((item) => String(item.targetId)),
    )
    const stale = (await db.mealPairings.toArray()).filter((r) => {
      const k = key(r.appellationId, r.color, r.mealId)
      return !serverKeys.has(k) && !pendingKeys.has(k)
    })
    await db.mealPairings.bulkDelete(stale.map((r) => [r.appellationId, r.color, r.mealId]))
    await db.mealPairings.bulkPut(
      edges.map((e) => ({ appellationId: e.appellation_id, color: e.color, mealId: e.meal_id })),
    )
  })
}
