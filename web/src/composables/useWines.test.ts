import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import type { WineDetail, WineInput } from '../api/types'
import { db } from '../db/localDb'
import { useWines } from './useWines'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const wine: WineDetail = {
  id: 42,
  millesime: 2018,
  appellation_id: 1,
  producer_id: 1,
  producer: { id: 1, name: 'Les Garillères' },
  color: 'rouge',
  garde_debut: 2020,
  garde_fin: 2028,
  quantity: 3,
  suggested_meals: [],
  consumption_history: [],
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('useWines — load', () => {
  it('resolves a stale negative id via idRemap once its create has synced', async () => {
    await db.wines.put(wine)
    await db.idRemap.put({ localId: -123, serverId: 42 })
    vi.mocked(apiClient.get).mockResolvedValue(wine)

    const { wine: current, load } = useWines()
    const resolvedId = await load(-123)

    expect(resolvedId).toBe(42)
    expect(current.value).toMatchObject({ id: 42 })
  })

  it('leaves a genuinely not-yet-synced negative id alone, without touching the network', async () => {
    const localOnly = { ...wine, id: -123 }
    await db.wines.put(localOnly)

    const { wine: current, load } = useWines()
    const resolvedId = await load(-123)

    expect(resolvedId).toBe(-123)
    expect(current.value).toMatchObject({ id: -123 })
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useWines — update', () => {
  it('redirects an update submitted against a stale negative id to the resolved server id', async () => {
    await db.wines.put(wine)
    await db.idRemap.put({ localId: -123, serverId: 42 })
    const input: WineInput = {
      millesime: 2019,
      appellation_id: 1,
      producer_id: 1,
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
    }

    const { update } = useWines()
    const saved = await update(-123, input)

    expect(saved).toMatchObject({ id: 42 })
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ action: 'update', targetId: 42 })
  })

  it('stores and queues the server ids when the form still holds local ids whose creates have since synced', async () => {
    await db.wines.put(wine)
    await db.producers.put({ id: 7, name: 'Domaine Nouveau' })
    await db.idRemap.bulkPut([
      { localId: -11, serverId: 7 },
      { localId: -22, serverId: 9 },
    ])
    const input: WineInput = {
      millesime: 2019,
      appellation_id: -22,
      producer_id: -11,
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
    }

    const { update } = useWines()
    await update(42, input)

    expect(await db.wines.get(42)).toMatchObject({
      appellation_id: 9,
      producer_id: 7,
      producer: { id: 7, name: 'Domaine Nouveau' },
    })
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems[0]?.payload).toMatchObject({ appellation_id: 9, producer_id: 7 })
  })

  it('keeps a local id that has not synced yet', async () => {
    await db.wines.put(wine)
    await db.producers.put({ id: -11, name: 'Pending Producer' })
    const input: WineInput = {
      millesime: 2019,
      appellation_id: 1,
      producer_id: -11,
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
    }

    const { update } = useWines()
    await update(42, input)

    expect(await db.wines.get(42)).toMatchObject({
      producer_id: -11,
      producer: { id: -11, name: 'Pending Producer' },
    })
  })

  it('still folds an edit into a still-pending create when genuinely unsynced', async () => {
    const localOnly = { ...wine, id: -123 }
    await db.wines.put(localOnly)
    await db.outbox.add({
      entity: 'wine',
      action: 'create',
      targetId: -123,
      payload: { color: 'rouge', client_id: 'abc' },
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
    })
    const input: WineInput = {
      millesime: 2019,
      appellation_id: 1,
      producer_id: 1,
      color: 'blanc',
      garde_debut: 2020,
      garde_fin: 2028,
    }

    const { update } = useWines()
    await update(-123, input)

    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ action: 'create', targetId: -123 })
    expect(outboxItems[0]!.payload).toMatchObject({ color: 'blanc', client_id: 'abc' })
  })
})

describe('useWines — deleteConsumption', () => {
  it('cancels a not-yet-synced consumption and restores the local quantity', async () => {
    await db.wines.put({
      ...wine,
      quantity: 2,
      consumption_history: [{ id: -1, wine_id: 42, date: '2026-03-01', rating: null, notes: null }],
    })
    await db.outbox.add({
      entity: 'consumption',
      action: 'create',
      targetId: -1,
      payload: { wineId: 42, body: { date: '2026-03-01', rating: null, notes: null, client_id: 'abc' } },
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
    })

    const { wine: current, load, deleteConsumption } = useWines()
    await load(42)
    const ok = await deleteConsumption(42, -1)

    expect(ok).toBe(true)
    expect(current.value).toMatchObject({ quantity: 3, consumption_history: [] })
    expect(await db.outbox.count()).toBe(0)
  })

  // A guard against a real race: the background push can replace a
  // not-yet-synced consumption's negative id with the real server one
  // between this view rendering and the user clicking delete. Without
  // checking that the outbox item was actually there to cancel, this would
  // otherwise bump quantity for a consumption that already synced.
  it('does not restore quantity when the consumption already synced before the cancel ran', async () => {
    await db.wines.put({
      ...wine,
      quantity: 1,
      consumption_history: [{ id: 99, wine_id: 42, date: '2026-03-01', rating: null, notes: null }],
    })
    vi.mocked(apiClient.get).mockResolvedValue({
      ...wine,
      quantity: 1,
      consumption_history: [{ id: 99, wine_id: 42, date: '2026-03-01', rating: null, notes: null }],
    })

    const { wine: current, load, deleteConsumption, deleteConsumptionError } = useWines()
    await load(42)
    const ok = await deleteConsumption(42, -1)

    expect(ok).toBe(false)
    expect(deleteConsumptionError.value).not.toBeNull()
    expect(current.value).toMatchObject({ quantity: 1 })
  })
})
