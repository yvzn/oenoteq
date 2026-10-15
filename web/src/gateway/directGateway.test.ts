import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { setConsent } from '../test/consent'
import { installFakeServer, type FakeServer } from '../test/fakeServer'
import { directGateway } from './directGateway'
import { describeGatewayContract } from './gatewayContract'
import { gateway } from './index'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

let server: FakeServer

beforeEach(() => {
  server = installFakeServer()
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

// Writes land on the server before the call resolves: nothing to wait for.
describeGatewayContract('direct adapter', () => ({ gateway: directGateway, server, settle: async () => {} }))

// Differences from the local-first adapter that the contract leaves open.
describe('direct adapter specifics', () => {
  it('writes straight to the server with server ids and no local state', async () => {
    const created = await directGateway.producers.create('Online')

    expect(created.id).toBeGreaterThan(0)
    expect(server.producers.map((p) => p.name)).toEqual(['Online'])
    expect(await db.producers.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('fails a write when the server is unreachable instead of queueing it', async () => {
    server.down = true

    const failure = await directGateway.meals.create('Lost').catch((e: unknown) => e)

    expect(failure).toMatchObject({ status: 0 })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.meals.count()).toBe(0)
  })

  it('does not fall back to a local copy when the server is unreachable', async () => {
    server.seedMeal('Boeuf')
    await directGateway.meals.list()
    server.down = true

    await expect(directGateway.meals.list()).rejects.toMatchObject({ status: 0 })
  })

  it('never reports a wine as pending: the id it returns is the server id', async () => {
    const producer = await directGateway.producers.create('P')
    const appellation = await directGateway.appellations.create('A')

    const wine = await directGateway.wines.create({
      millesime: 2020,
      appellation_id: appellation.id,
      producer_id: producer.id,
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      initial_quantity: 1,
    })

    expect(wine.id).toBe(server.wines[0].id)
  })
})

describe('gateway selection from the consent record', () => {
  it.each([
    ['refused', false],
    ['no-choice', false],
    ['granted', true],
  ] as const)('with %s, local-first is used: %s', async (state, localFirst) => {
    setConsent(state)

    await gateway.producers.create('X')

    // Local-first writes a local id into the local store; direct never touches it.
    expect(await db.producers.count()).toBe(localFirst ? 1 : 0)
  })
})
