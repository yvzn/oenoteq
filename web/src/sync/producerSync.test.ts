import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import {
  enqueueProducerCreate,
  enqueueProducerUpdate,
  patchPendingProducerCreate,
  pullProducers,
  pushProducers,
} from './producerSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('pullProducers', () => {
  it('upserts server producers into the local store', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, name: 'Domaine du Closel' }])

    await pullProducers()

    expect(await db.producers.get(1)).toEqual({ id: 1, name: 'Domaine du Closel' })
  })

  it('drops a local producer with a server id that no longer exists on the server', async () => {
    await db.producers.put({ id: 6, name: 'Gone' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullProducers()

    expect(await db.producers.get(6)).toBeUndefined()
  })

  it('keeps a not-yet-synced local producer (negative id)', async () => {
    await db.producers.put({ id: -123, name: 'Pending' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullProducers()

    expect(await db.producers.get(-123)).toBeDefined()
  })
})

describe('pushProducers', () => {
  it('replaces the local temp record with the server one on a successful create', async () => {
    await db.producers.put({ id: -1, name: 'Pending Domaine' })
    await enqueueProducerCreate(-1, { name: 'Pending Domaine', client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 42, name: 'Pending Domaine' })

    await pushProducers()

    expect(apiClient.post).toHaveBeenCalledWith('/producers', expect.objectContaining({ client_id: 'abc' }))
    expect(await db.producers.get(-1)).toBeUndefined()
    expect(await db.producers.get(42)).toEqual({ id: 42, name: 'Pending Domaine' })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.idRemap.get(-1)).toEqual({ localId: -1, serverId: 42 })
  })

  it('sends an update for an already-synced producer by its server id', async () => {
    await enqueueProducerUpdate(5, { name: 'Renamed' })
    vi.mocked(apiClient.put).mockResolvedValue({ id: 5, name: 'Renamed' })

    await pushProducers()

    expect(apiClient.put).toHaveBeenCalledWith('/producers/5', { name: 'Renamed' })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('patchPendingProducerCreate', () => {
  it('folds an edit of a not-yet-synced producer into its still-pending create payload', async () => {
    await enqueueProducerCreate(-1, { name: 'Original', client_id: 'abc' })

    const patched = await patchPendingProducerCreate(-1, { name: 'Renamed' })

    expect(patched).toBe(true)
    const [item] = await db.outbox.toArray()
    expect(item!.payload).toMatchObject({ name: 'Renamed', client_id: 'abc' })
  })

  it('returns false when there is no pending create for that local id', async () => {
    const patched = await patchPendingProducerCreate(-999, { name: 'Renamed' })

    expect(patched).toBe(false)
  })
})
