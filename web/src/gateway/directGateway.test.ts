import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { ApiError } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import { db } from '../db/localDb'
import { emptySearchFilters } from '../domain/searchFilters'
import { defaultWineSort } from '../domain/wineSort'
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

describe('direct adapter search', () => {
  it('returns the server search result as is', async () => {
    const wine = server.seedWine({
      millesime: 2018,
      appellation_id: 1,
      producer_id: server.seedProducer('P').id,
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      quantity: 1,
    })
    server.searchResults = [{ ...wine, garde_status: 'unassessed' }]

    const results = await directGateway.search(emptySearchFilters, defaultWineSort)

    expect(results).toEqual(server.searchResults)
    expect(server.searches).toEqual(['/search'])
  })

  it('passes every filter and the sort through to the search', async () => {
    await directGateway.search(
      { mealId: 7, appellationId: 3, color: 'blanc', readyNow: true },
      { sortBy: 'producer', sortDir: 'desc' },
    )

    const query = new URLSearchParams(server.searches[0].split('?')[1])
    expect(Object.fromEntries(query)).toEqual({
      meal_id: '7',
      appellation_id: '3',
      color: 'blanc',
      ready_now: 'true',
      sort_by: 'producer',
      sort_dir: 'desc',
    })
  })

  it('surfaces an unreachable server as a friendly error', async () => {
    server.down = true

    const failure = await directGateway.search(emptySearchFilters, defaultWineSort).catch((e: unknown) => e)

    expect(failure).toBeInstanceOf(ApiError)
    expect(friendlyErrorMessage(failure)).toContain('unable to reach the server')
  })

  it('watching delivers the search result once, then nothing after unsubscribing', async () => {
    const onResult = vi.fn()
    const stop = directGateway.watchSearch(emptySearchFilters, defaultWineSort, onResult, vi.fn())
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1))
    stop()

    const onLate = vi.fn()
    directGateway.watchSearch(emptySearchFilters, defaultWineSort, onLate, vi.fn())()
    await new Promise((r) => setTimeout(r, 10))

    expect(onLate).not.toHaveBeenCalled()
  })

  it('watching reports an unreachable server through onError', async () => {
    server.down = true
    const onError = vi.fn()

    directGateway.watchSearch(emptySearchFilters, defaultWineSort, vi.fn(), onError)

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(ApiError)))
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
