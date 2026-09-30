import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import {
  enqueueAppellationCreate,
  enqueueAppellationUpdate,
  patchPendingAppellationCreate,
  pullAppellations,
  pushAppellations,
} from './appellationSync'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

describe('pullAppellations', () => {
  it('upserts server appellations into the local store', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, name: 'Chinon' }])

    await pullAppellations()

    expect(await db.appellations.get(1)).toEqual({ id: 1, name: 'Chinon' })
  })

  it('drops a local appellation with a server id that no longer exists on the server', async () => {
    await db.appellations.put({ id: 6, name: 'Gone' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullAppellations()

    expect(await db.appellations.get(6)).toBeUndefined()
  })

  it('keeps a not-yet-synced local appellation (negative id)', async () => {
    await db.appellations.put({ id: -123, name: 'Pending' })
    vi.mocked(apiClient.get).mockResolvedValue([])

    await pullAppellations()

    expect(await db.appellations.get(-123)).toBeDefined()
  })
})

describe('pushAppellations', () => {
  it('replaces the local temp record with the server one on a successful create', async () => {
    await db.appellations.put({ id: -1, name: 'Pending Appellation' })
    await enqueueAppellationCreate(-1, { name: 'Pending Appellation', client_id: 'abc' })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 42, name: 'Pending Appellation' })

    await pushAppellations()

    expect(apiClient.post).toHaveBeenCalledWith(
      '/appellations',
      expect.objectContaining({ client_id: 'abc' }),
    )
    expect(await db.appellations.get(-1)).toBeUndefined()
    expect(await db.appellations.get(42)).toEqual({ id: 42, name: 'Pending Appellation' })
    expect(await db.outbox.count()).toBe(0)
    expect(await db.idRemap.get(-1)).toEqual({ localId: -1, serverId: 42 })
  })

  it('sends an update for an already-synced appellation by its server id', async () => {
    await enqueueAppellationUpdate(5, { name: 'Renamed' })
    vi.mocked(apiClient.put).mockResolvedValue({ id: 5, name: 'Renamed' })

    await pushAppellations()

    expect(apiClient.put).toHaveBeenCalledWith('/appellations/5', { name: 'Renamed' })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('patchPendingAppellationCreate', () => {
  it('folds an edit of a not-yet-synced appellation into its still-pending create payload', async () => {
    await enqueueAppellationCreate(-1, { name: 'Original', client_id: 'abc' })

    const patched = await patchPendingAppellationCreate(-1, { name: 'Renamed' })

    expect(patched).toBe(true)
    const [item] = await db.outbox.toArray()
    expect(item!.payload).toMatchObject({ name: 'Renamed', client_id: 'abc' })
  })

  it('returns false when there is no pending create for that local id', async () => {
    const patched = await patchPendingAppellationCreate(-999, { name: 'Renamed' })

    expect(patched).toBe(false)
  })
})
