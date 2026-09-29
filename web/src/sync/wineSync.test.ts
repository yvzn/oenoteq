import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { enqueueWineCreate, enqueueWineUpdate, patchPendingWineCreate, pullWine, pullWines, pushWines } from './wineSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

const producer = { id: 1, name: 'Les Garillères' }

const wine = {
  id: 5,
  millesime: 2018,
  appellation_id: 1,
  producer_id: 1,
  producer,
  color: 'rouge' as const,
  garde_debut: 2020,
  garde_fin: 2028,
  quantity: 3,
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('pullWines', () => {
  it('upserts server wines and producers into the local store', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve([wine])
      if (path === '/producers') return Promise.resolve([producer])
      throw new Error(`unexpected path: ${path}`)
    })

    await pullWines()

    expect(await db.wines.get(5)).toMatchObject({ ...wine, suggested_meals: [], consumption_history: [] })
    expect(await db.producers.get(1)).toEqual(producer)
  })

  it('preserves an already-cached wine detail (suggested meals, consumption history)', async () => {
    await db.wines.put({ ...wine, suggested_meals: [{ id: 1, name: 'Boeuf' }], consumption_history: [] })
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve([{ ...wine, quantity: 2 }])
      if (path === '/producers') return Promise.resolve([producer])
      throw new Error(`unexpected path: ${path}`)
    })

    await pullWines()

    expect(await db.wines.get(5)).toMatchObject({
      quantity: 2,
      suggested_meals: [{ id: 1, name: 'Boeuf' }],
    })
  })

  it('drops a local wine with a server id that no longer exists on the server', async () => {
    await db.wines.put({ ...wine, id: 6, suggested_meals: [], consumption_history: [] })
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve([wine])
      if (path === '/producers') return Promise.resolve([producer])
      throw new Error(`unexpected path: ${path}`)
    })

    await pullWines()

    expect(await db.wines.get(6)).toBeUndefined()
  })

  it('keeps a not-yet-synced local wine (negative id) even though the server has never heard of it', async () => {
    await db.wines.put({ ...wine, id: -123, suggested_meals: [], consumption_history: [] })
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve([])
      if (path === '/producers') return Promise.resolve([])
      throw new Error(`unexpected path: ${path}`)
    })

    await pullWines()

    expect(await db.wines.get(-123)).toBeDefined()
  })
})

describe('pullWine', () => {
  it('fetches and caches a single wine detail', async () => {
    const detail = { ...wine, suggested_meals: [], consumption_history: [] }
    vi.mocked(apiClient.get).mockResolvedValue(detail)

    const result = await pullWine(5)

    expect(result).toEqual(detail)
    expect(await db.wines.get(5)).toEqual(detail)
  })
})

describe('pushWines', () => {
  it('replaces the local temp record with the server one on a successful create', async () => {
    await db.wines.put({ ...wine, id: -1, suggested_meals: [], consumption_history: [] })
    await enqueueWineCreate(-1, { ...wine, initial_quantity: 3, client_id: 'abc' } as never)
    vi.mocked(apiClient.post).mockResolvedValue({ ...wine, id: 42 })

    await pushWines()

    expect(apiClient.post).toHaveBeenCalledWith('/wines', expect.objectContaining({ client_id: 'abc' }))
    expect(await db.wines.get(-1)).toBeUndefined()
    expect(await db.wines.get(42)).toMatchObject({ id: 42 })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.idRemap.get(-1)).toEqual({ localId: -1, serverId: 42 })
  })

  it('sends an update for an already-synced wine by its server id', async () => {
    await enqueueWineUpdate(5, { millesime: 2019 } as never)
    vi.mocked(apiClient.put).mockResolvedValue({ ...wine, millesime: 2019 })

    await pushWines()

    expect(apiClient.put).toHaveBeenCalledWith('/wines/5', { millesime: 2019 })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.idRemap.count()).toBe(0)
  })
})

describe('patchPendingWineCreate', () => {
  it('folds an edit of a not-yet-synced wine into its still-pending create payload', async () => {
    await enqueueWineCreate(-1, { color: 'rouge', client_id: 'abc' } as never)

    const patched = await patchPendingWineCreate(-1, { color: 'blanc' } as never)

    expect(patched).toBe(true)
    const [item] = await db.outbox.toArray()
    expect(item!.payload).toMatchObject({ color: 'blanc', client_id: 'abc' })
  })

  it('returns false when there is no pending create for that local id', async () => {
    const patched = await patchPendingWineCreate(-999, { color: 'blanc' } as never)

    expect(patched).toBe(false)
  })
})
