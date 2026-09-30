import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { enqueueMealPairingAdd, pullMealPairings, pushMealPairings } from './mealPairingSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('pullMealPairings', () => {
  it('fetches and caches the paired meals for one appellation+color', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, name: 'Boeuf bourguignon' }])

    const meals = await pullMealPairings(1, 'rouge')

    expect(apiClient.get).toHaveBeenCalledWith('/meal-pairings?appellation_id=1&color=rouge')
    expect(meals).toEqual([{ id: 1, name: 'Boeuf bourguignon' }])
    expect(await db.mealPairings.get([1, 'rouge', 1])).toEqual({ appellationId: 1, color: 'rouge', mealId: 1 })
    expect(await db.meals.get(1)).toEqual({ id: 1, name: 'Boeuf bourguignon' })
  })

  it('replaces a stale cached pairing set for that appellation+color', async () => {
    await db.mealPairings.put({ appellationId: 1, color: 'rouge', mealId: 9 })
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, name: 'Boeuf bourguignon' }])

    await pullMealPairings(1, 'rouge')

    expect(await db.mealPairings.get([1, 'rouge', 9])).toBeUndefined()
    expect(await db.mealPairings.get([1, 'rouge', 1])).toBeDefined()
  })
})

describe('pushMealPairings', () => {
  it('sends an add with already-synced ids as-is', async () => {
    await enqueueMealPairingAdd({ appellationId: 1, color: 'rouge', mealId: 2 })
    vi.mocked(apiClient.post).mockResolvedValue({ appellation_id: 1, color: 'rouge', meal_id: 2 })

    await pushMealPairings()

    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 2,
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('resolves a not-yet-synced appellation/meal local id before pushing', async () => {
    await db.idRemap.put({ localId: -10, serverId: 7 })
    await db.idRemap.put({ localId: -20, serverId: 8 })
    await enqueueMealPairingAdd({ appellationId: -10, color: 'rouge', mealId: -20 })
    vi.mocked(apiClient.post).mockResolvedValue({ appellation_id: 7, color: 'rouge', meal_id: 8 })

    await pushMealPairings()

    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 7,
      color: 'rouge',
      meal_id: 8,
    })
  })

  it('leaves an add pending (not failed) when a referenced appellation/meal has not synced yet', async () => {
    await enqueueMealPairingAdd({ appellationId: -10, color: 'rouge', mealId: 2 })

    await pushMealPairings()

    expect(apiClient.post).not.toHaveBeenCalled()
    const [item] = await db.outbox.toArray()
    expect(item).toMatchObject({ status: 'pending' })
  })
})
