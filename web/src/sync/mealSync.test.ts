import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { enqueueMealCreate, enqueueMealUpdate, patchPendingMealCreate, pullMeals, pushMeals } from './mealSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('pullMeals', () => {
  it('upserts server meals into the local store', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, name: 'Boeuf bourguignon' }])

    await pullMeals()

    expect(await db.meals.get(1)).toEqual({ id: 1, name: 'Boeuf bourguignon' })
  })

  it('drops a local meal with a server id that no longer exists on the server', async () => {
    await db.meals.put({ id: 6, name: 'Gone' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullMeals()

    expect(await db.meals.get(6)).toBeUndefined()
  })

  it('keeps a not-yet-synced local meal (negative id)', async () => {
    await db.meals.put({ id: -123, name: 'Pending' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullMeals()

    expect(await db.meals.get(-123)).toBeDefined()
  })
})

describe('pushMeals', () => {
  it('replaces the local temp record with the server one on a successful create', async () => {
    await db.meals.put({ id: -1, name: 'Pending Meal' })
    await enqueueMealCreate(-1, { name: 'Pending Meal', client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 42, name: 'Pending Meal' })

    await pushMeals()

    expect(apiClient.post).toHaveBeenCalledWith('/meals', expect.objectContaining({ client_id: 'abc' }))
    expect(await db.meals.get(-1)).toBeUndefined()
    expect(await db.meals.get(42)).toEqual({ id: 42, name: 'Pending Meal' })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.idRemap.get(-1)).toEqual({ localId: -1, serverId: 42 })
  })

  it('sends an update for an already-synced meal by its server id', async () => {
    await enqueueMealUpdate(5, { name: 'Renamed' })
    vi.mocked(apiClient.put).mockResolvedValue({ id: 5, name: 'Renamed' })

    await pushMeals()

    expect(apiClient.put).toHaveBeenCalledWith('/meals/5', { name: 'Renamed' })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('patchPendingMealCreate', () => {
  it('folds an edit of a not-yet-synced meal into its still-pending create payload', async () => {
    await enqueueMealCreate(-1, { name: 'Original', client_id: 'abc' })

    const patched = await patchPendingMealCreate(-1, { name: 'Renamed' })

    expect(patched).toBe(true)
    const [item] = await db.outbox.toArray()
    expect(item!.payload).toMatchObject({ name: 'Renamed', client_id: 'abc' })
  })

  it('returns false when there is no pending create for that local id', async () => {
    const patched = await patchPendingMealCreate(-999, { name: 'Renamed' })

    expect(patched).toBe(false)
  })
})
