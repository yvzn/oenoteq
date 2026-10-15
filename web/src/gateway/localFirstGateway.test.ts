import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
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
