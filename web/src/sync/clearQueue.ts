import { db } from '../db/localDb'
import { discardAll, type OutboxItem } from './outbox'
import type { ConsumptionBody, QuantityAdjustmentPayload } from './consumptionSync'
import type { MealPairingAddPayload } from './mealPairingSync'

// Undoes the optimistic local effect of one discarded outbox item, using only
// local data so it also works offline. Updates to records that already exist
// at the server have nothing to undo here: the follow-up pull (now that the
// record isn't queued anymore) overwrites them with server state.
async function undoLocalEffect(item: OutboxItem): Promise<void> {
  const isLocalCreate = item.action === 'create' && typeof item.targetId === 'number' && item.targetId < 0
  switch (item.entity) {
    case 'wine':
      if (isLocalCreate) await db.wines.delete(item.targetId as number)
      return
    case 'producer':
      if (isLocalCreate) await db.producers.delete(item.targetId as number)
      return
    case 'appellation':
      if (isLocalCreate) await db.appellations.delete(item.targetId as number)
      return
    case 'meal':
      if (isLocalCreate) await db.meals.delete(item.targetId as number)
      return
    case 'meal_pairing': {
      const { appellationId, color, mealId } = item.payload as MealPairingAddPayload
      await db.mealPairings.delete([appellationId, color, mealId])
      return
    }
    case 'quantity_adjustment': {
      const { delta } = item.payload as QuantityAdjustmentPayload
      const wine = await db.wines.get(item.targetId as number)
      if (wine) await db.wines.update(wine.id, { quantity: wine.quantity - delta })
      return
    }
    case 'consumption': {
      if (!isLocalCreate) return
      const { wineId } = item.payload as { wineId: number; body: ConsumptionBody }
      const wine = await db.wines.get(wineId)
      if (!wine) return
      await db.wines.update(wineId, {
        quantity: wine.quantity + 1,
        consumption_history: wine.consumption_history.filter((c) => c.id !== item.targetId),
      })
    }
  }
}

// Empties the outbox and rolls back what the discarded items did to the local
// store. Returns how many items were dropped. Convergence with the server
// (reverting discarded edits to existing records) is the caller's follow-up
// pull; when offline that is deferred to the next reconnect sync.
export async function clearQueue(): Promise<number> {
  const items = await discardAll(db.outbox)
  // Newest first, so a wine's later adjustments are undone before its create deletes it.
  for (const item of [...items].reverse()) await undoLocalEffect(item)
  return items.length
}
