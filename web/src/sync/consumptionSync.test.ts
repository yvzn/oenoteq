import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient } from '../api/client'
import type { WineDetail } from '../api/types'
import { db } from '../db/localDb'
import {
  cancelPendingConsumptionCreate,
  enqueueConsumptionCreate,
  enqueueConsumptionUpdate,
  enqueueQuantityAdjustment,
  patchPendingConsumptionCreate,
  pushConsumptions,
} from './consumptionSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

const wine: WineDetail = {
  id: 5,
  millesime: 2018,
  appellation_id: 1,
  producer_id: 1,
  producer: { id: 1, name: 'Les Garillères' },
  color: 'rouge',
  garde_debut: 2020,
  garde_fin: 2028,
  quantity: 2,
  suggested_meals: [],
  consumption_history: [{ id: -1, wine_id: 5, date: '2026-03-01', rating: 5, notes: 'Superb' }],
}

afterEach(() => {
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('pushConsumptions — consumption create', () => {
  it('replaces the temp consumption entry with the server one on success', async () => {
    await db.wines.put(wine)
    await enqueueConsumptionCreate(-1, 5, { date: '2026-03-01', rating: 5, notes: 'Superb', client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 42, wine_id: 5, date: '2026-03-01', rating: 5, notes: 'Superb' })

    await pushConsumptions()

    expect(apiClient.post).toHaveBeenCalledWith(
      '/wines/5/consumptions',
      expect.objectContaining({ client_id: 'abc' }),
    )
    const saved = await db.wines.get(5)
    expect(saved!.consumption_history).toEqual([{ id: 42, wine_id: 5, date: '2026-03-01', rating: 5, notes: 'Superb' }])
    expect(await db.outbox.count()).toBe(0)
  })

  it('resolves a not-yet-synced wine id via idRemap before pushing', async () => {
    await db.wines.put({ ...wine, id: 5 })
    await db.idRemap.put({ localId: -100, serverId: 5 })
    await enqueueConsumptionCreate(-1, -100, { date: '2026-03-01', rating: null, notes: null, client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 42, wine_id: 5, date: '2026-03-01', rating: null, notes: null })

    await pushConsumptions()

    expect(apiClient.post).toHaveBeenCalledWith('/wines/5/consumptions', expect.anything())
  })

  it('treats a network error as retryable, leaving the item pending', async () => {
    await db.wines.put(wine)
    await enqueueConsumptionCreate(-1, 5, { date: '2026-03-01', rating: null, notes: null, client_id: 'abc' })
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(0, 'Network error: unable to reach the server'))

    await pushConsumptions()

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ status: 'pending' })
  })
})

describe('pushConsumptions — consumption update', () => {
  it('sends a PUT for an already-synced consumption', async () => {
    await enqueueConsumptionUpdate(1, { date: '2026-03-02', rating: 4, notes: 'Revised' })
    vi.mocked(apiClient.put).mockResolvedValue({ id: 1, wine_id: 5, date: '2026-03-02', rating: 4, notes: 'Revised' })

    await pushConsumptions()

    expect(apiClient.put).toHaveBeenCalledWith('/consumptions/1', {
      date: '2026-03-02',
      rating: 4,
      notes: 'Revised',
    })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('pushConsumptions — quantity adjustment', () => {
  it('applies the adjustment and updates the local quantity with the server value', async () => {
    await db.wines.put(wine)
    await enqueueQuantityAdjustment(5, { delta: 3, client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ ...wine, quantity: 5 })

    await pushConsumptions()

    expect(apiClient.post).toHaveBeenCalledWith('/wines/5/quantity-adjustments', { delta: 3, client_id: 'abc' })
    expect(await db.wines.get(5)).toMatchObject({ quantity: 5 })
    expect(await db.outbox.count()).toBe(0)
  })

  it('is idempotent on retry: replaying the same item twice only calls the API once', async () => {
    await db.wines.put(wine)
    await enqueueQuantityAdjustment(5, { delta: 3, client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ ...wine, quantity: 5 })

    await pushConsumptions()
    await pushConsumptions()

    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })
})

describe('patchPendingConsumptionCreate', () => {
  it('folds an edit of a not-yet-synced consumption into its still-pending create payload', async () => {
    await enqueueConsumptionCreate(-1, 5, { date: '2026-03-01', rating: 5, notes: 'Superb', client_id: 'abc' })

    const patched = await patchPendingConsumptionCreate(-1, { date: '2026-03-02', rating: 4, notes: 'Revised' })

    expect(patched).toBe(true)
    const [item] = await db.outbox.toArray()
    expect(item!.payload).toMatchObject({
      wineId: 5,
      body: { date: '2026-03-02', rating: 4, notes: 'Revised', client_id: 'abc' },
    })
  })

  it('returns false when there is no pending create for that local id', async () => {
    const patched = await patchPendingConsumptionCreate(-999, { date: '2026-03-02', rating: null, notes: null })

    expect(patched).toBe(false)
  })
})

describe('cancelPendingConsumptionCreate', () => {
  it('removes the still-pending create from the outbox', async () => {
    await enqueueConsumptionCreate(-1, 5, { date: '2026-03-01', rating: null, notes: null, client_id: 'abc' })

    const canceled = await cancelPendingConsumptionCreate(-1)

    expect(canceled).toBe(true)
    expect(await db.outbox.count()).toBe(0)
  })

  it('returns false when there is no pending create for that local id', async () => {
    const canceled = await cancelPendingConsumptionCreate(-999)

    expect(canceled).toBe(false)
  })
})
