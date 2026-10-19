import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { defaultConsumptionHistorySort } from '../domain/consumptionHistorySort'
import { emptySearchFilters } from '../domain/searchFilters'
import { defaultWineSort } from '../domain/wineSort'
import { installFakeServer, type FakeServer } from '../test/fakeServer'
import { describeGatewayContract } from './gatewayContract'
import { pushChangesInBackground } from '../sync'
import { gateway } from './index'
import { localFirstGateway } from './localFirstGateway'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

let server: FakeServer

beforeEach(() => {
  server = installFakeServer()
})

afterEach(async () => {
  // Let background pushes finish before the shared local store is cleared.
  if (!server.down) await settle()
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

async function settle(): Promise<void> {
  await vi.waitFor(async () => {
    const open = await db.outbox.filter((i) => i.status !== 'failed').count()
    expect(open).toBe(0)
  })
}

it('is the active adapter once storage consent is granted', async () => {
  await gateway.producers.create('Active')

  expect(await db.producers.count()).toBe(1)
})

describeGatewayContract('local-first adapter', () => ({ gateway: localFirstGateway, server, settle }))

// Differences from a direct-to-server adapter that the contract leaves open.
describe('local-first adapter specifics', () => {
  beforeEach(() => {
    // Hold pushes back so the queued state is observable.
    server.down = true
  })

  it('writes locally first: create works with the server unreachable, with a local id and a queued create', async () => {
    const created = await localFirstGateway.producers.create('Offline')

    expect(created.id).toBeLessThan(0)
    expect(await db.producers.get(created.id)).toEqual(created)
    const queued = await db.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ entity: 'producer', action: 'create', targetId: created.id })
  })

  it('remaps the local id once the queued create reaches the server', async () => {
    const created = await localFirstGateway.producers.create('Offline')
    server.down = false
    pushChangesInBackground()
    await settle()

    expect(await db.idRemap.get(created.id)).toMatchObject({ localId: created.id })
    expect(server.producers.map((p) => p.name)).toEqual(['Offline'])
  })

  it('reads fall back to the local copy when the server is unreachable', async () => {
    await localFirstGateway.meals.create('Cached')

    expect((await localFirstGateway.meals.list()).map((m) => m.name)).toEqual(['Cached'])
  })

  it('keeps a wine readable by a stale local id after its create synced', async () => {
    const producer = await localFirstGateway.producers.create('P')
    const appellation = await localFirstGateway.appellations.create('A')
    const created = await localFirstGateway.wines.create({
      millesime: 2018,
      appellation_id: appellation.id,
      producer_id: producer.id,
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      initial_quantity: 2,
    })
    server.down = false
    pushChangesInBackground()
    await settle()

    const result = await localFirstGateway.wines.get(created.id)

    expect(created.id).toBeLessThan(0)
    expect(result.resolvedId).toBeGreaterThan(0)
    expect(result.wine?.id).toBe(result.resolvedId)
  })

  it('dequeues an unsent consumption instead of calling the server when deleting it', async () => {
    const producer = await localFirstGateway.producers.create('P')
    const appellation = await localFirstGateway.appellations.create('A')
    server.down = false
    await settle()
    server.down = true
    const created = await localFirstGateway.wines.create({
      millesime: null,
      appellation_id: appellation.id,
      producer_id: producer.id,
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      initial_quantity: 2,
    })
    const recorded = await localFirstGateway.wines.recordConsumption(created.id, {
      date: '2026-01-02',
      rating: null,
      notes: null,
    })
    vi.mocked(apiClient.delete).mockClear()

    const after = await localFirstGateway.wines.deleteConsumption(created.id, recorded.consumption_history[0].id)

    expect(after).toMatchObject({ quantity: 2, consumption_history: [] })
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(await db.outbox.where('entity').equals('consumption').count()).toBe(0)
  })
})

describe('local-first adapter search', () => {
  const seedStock = async (id: number, quantity: number) => {
    await db.producers.put({ id: 1, name: 'P' })
    await db.appellations.put({ id: 1, name: 'A' })
    await db.wines.put({
      id,
      millesime: 2018,
      appellation_id: 1,
      producer_id: 1,
      producer: { id: 1, name: 'P' },
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      quantity,
      suggested_meals: [],
      consumption_history: [],
    })
  }

  it('reads the local copy without asking the server, even offline', async () => {
    await seedStock(-1, 2)
    server.down = true

    const results = await localFirstGateway.search(emptySearchFilters, defaultWineSort)

    expect(results.map((w) => w.id)).toEqual([-1])
    expect(server.searches).toEqual([])
  })

  it('watching re-delivers when the local store changes', async () => {
    await seedStock(-1, 2)
    const seen: number[][] = []
    const stop = localFirstGateway.watchSearch(
      emptySearchFilters,
      defaultWineSort,
      (r) => seen.push(r.map((w) => w.id)),
      vi.fn(),
    )
    await vi.waitFor(() => expect(seen.at(-1)).toEqual([-1]))

    await seedStock(-2, 1)
    await vi.waitFor(() => expect(seen.at(-1)).toEqual([-2, -1]))
    await db.wines.update(-1, { quantity: 0 })
    await vi.waitFor(() => expect(seen.at(-1)).toEqual([-2]))
    stop()

    expect(server.searches).toEqual([])
  })
})

describe('local-first adapter consumption history', () => {
  it('is online-only: never falls back to consumptions held in the local copy', async () => {
    await db.producers.put({ id: 1, name: 'P' })
    await db.wines.put({
      id: 1,
      millesime: 2018,
      appellation_id: 1,
      producer_id: 1,
      producer: { id: 1, name: 'P' },
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      quantity: 0,
      suggested_meals: [],
      consumption_history: [{ id: 1, wine_id: 1, date: '2026-01-02', rating: null, notes: null }],
    })
    server.down = true

    await expect(localFirstGateway.consumptionHistory(defaultConsumptionHistorySort)).rejects.toThrow()
  })

  it('leaves the local store untouched', async () => {
    server.consumptionHistory = [
      {
        id: 7,
        wine_id: 3,
        date: '2026-02-01',
        producer: { id: 2, name: 'P' },
        appellation_id: 5,
        color: 'rouge',
        millesime: 2018,
      },
    ]

    await localFirstGateway.consumptionHistory(defaultConsumptionHistorySort)

    expect(await db.wines.count()).toBe(0)
    expect(await db.producers.count()).toBe(0)
  })
})
