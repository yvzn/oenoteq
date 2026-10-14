import { describe, expect, it } from 'vitest'
import type { WineDetail } from '../api/types'
import { db } from '../db/localDb'
import { clearQueue } from './clearQueue'
import { enqueue } from './outbox'

function wine(id: number, quantity: number, consumption_history: WineDetail['consumption_history'] = []): WineDetail {
  return {
    id,
    millesime: 2018,
    appellation_id: 1,
    producer_id: 1,
    producer: { id: 1, name: 'P' },
    color: 'rouge',
    garde_debut: 2020,
    garde_fin: 2028,
    quantity,
    suggested_meals: [],
    consumption_history,
  }
}

describe('clearQueue', () => {
  it('returns 0 and touches nothing when the outbox is empty', async () => {
    await db.wines.put(wine(5, 2))
    expect(await clearQueue()).toBe(0)
    expect((await db.wines.get(5))!.quantity).toBe(2)
  })

  it('removes local-only records created by discarded items', async () => {
    await db.wines.put(wine(-1, 1))
    await db.producers.put({ id: -2, name: 'New' })
    await db.appellations.put({ id: -3, name: 'App' } as never)
    await db.meals.put({ id: -4, name: 'Beef' } as never)
    await db.wines.put(wine(7, 1))
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })
    await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -2, payload: {} })
    await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -3, payload: {} })
    await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -4, payload: {} })
    await enqueue(db.outbox, { entity: 'wine', action: 'update', targetId: 7, payload: {} })

    expect(await clearQueue()).toBe(5)

    expect(await db.wines.get(-1)).toBeUndefined()
    expect(await db.producers.get(-2)).toBeUndefined()
    expect(await db.appellations.get(-3)).toBeUndefined()
    expect(await db.meals.get(-4)).toBeUndefined()
    expect(await db.wines.get(7)).toBeDefined()
    expect(await db.outbox.count()).toBe(0)
  })

  it('reverts quantity adjustments and queued consumptions on existing wines', async () => {
    await db.wines.put(wine(5, 3, [{ id: -9, wine_id: 5, date: '2026-03-01', rating: 4, notes: null }]))
    await enqueue(db.outbox, {
      entity: 'quantity_adjustment',
      action: 'create',
      targetId: 5,
      payload: { delta: 2, client_id: 'a' },
    })
    await enqueue(db.outbox, {
      entity: 'consumption',
      action: 'create',
      targetId: -9,
      payload: { wineId: 5, body: { date: '2026-03-01', rating: 4, notes: null } },
    })

    await clearQueue()

    const after = (await db.wines.get(5))!
    expect(after.quantity).toBe(2)
    expect(after.consumption_history).toEqual([])
  })

  it('drops the local meal-pairing edge of a discarded add', async () => {
    await db.mealPairings.put({ appellationId: 1, color: 'rouge', mealId: 2 })
    await enqueue(db.outbox, {
      entity: 'meal_pairing',
      action: 'create',
      targetId: '1:rouge:2',
      payload: { appellationId: 1, color: 'rouge', mealId: 2 },
    })

    await clearQueue()

    expect(await db.mealPairings.count()).toBe(0)
  })
})
