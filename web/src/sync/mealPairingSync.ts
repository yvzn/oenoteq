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
// appellation+color — there's no bulk "list all pairings" endpoint to
// support full replication, so this is pulled on demand instead.
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
