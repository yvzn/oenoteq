import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/localDb'
import { syncNow } from '../sync'
import { enqueue } from '../sync/outbox'
import { setConsent } from '../test/consent'
import { deleteLocalData } from './deleteLocalData'
import { reloadInto } from './reload'
import { readConsent } from './storageConsent'
import { LOCALE_STORAGE_KEY } from '../i18n/localePreference'
import { countUnsentChanges, withdrawConsent } from './withdrawal'

vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('../sync', () => ({ syncNow: vi.fn() }))
vi.mock('./reload', () => ({ reloadInto: vi.fn() }))
vi.mock('./deleteLocalData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deleteLocalData')>()),
  deleteLocalData: vi.fn().mockResolvedValue(undefined),
}))

const queued = { entity: 'wine', action: 'create', targetId: -1, payload: {} } as const

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(syncNow).mockReset().mockResolvedValue(undefined)
  vi.mocked(reloadInto).mockClear()
  vi.mocked(deleteLocalData).mockClear()
  setOnline(true)
})

describe('countUnsentChanges', () => {
  it('is zero after syncing an empty outbox, so withdrawing can go straight ahead', async () => {
    await db.open()
    expect(await countUnsentChanges()).toBe(0)
    expect(syncNow).toHaveBeenCalledOnce()
  })

  it('counts nothing for a device with no local store, without syncing or creating one', async () => {
    await db.delete()
    expect(await countUnsentChanges()).toBe(0)
    expect(syncNow).not.toHaveBeenCalled()
    expect(await indexedDB.databases()).toEqual([])
    await db.open()
  })

  it('is zero when the sync empties the outbox', async () => {
    await enqueue(db.outbox, queued)
    vi.mocked(syncNow).mockImplementation(async () => void (await db.outbox.clear()))
    expect(await countUnsentChanges()).toBe(0)
  })

  it('counts pending items the sync could not send', async () => {
    await enqueue(db.outbox, queued)
    await enqueue(db.outbox, queued)
    expect(await countUnsentChanges()).toBe(2)
  })

  it('counts failed items too', async () => {
    const id = await enqueue(db.outbox, queued)
    await db.outbox.update(id, { status: 'failed', error: 'already_exists' })
    expect(await countUnsentChanges()).toBe(1)
  })

  it('does not sync while offline, and counts what is queued', async () => {
    setOnline(false)
    await enqueue(db.outbox, queued)
    expect(await countUnsentChanges()).toBe(1)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('counts what is queued when the sync fails', async () => {
    await enqueue(db.outbox, queued)
    vi.mocked(syncNow).mockRejectedValue(new Error('boom'))
    expect(await countUnsentChanges()).toBe(1)
  })
})

describe('withdrawConsent', () => {
  it('deletes the local data, records the refusal, drops the kept language, then reloads', async () => {
    setConsent('granted')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    vi.mocked(deleteLocalData).mockImplementation(async () => expect(readConsent()).toBe('granted'))

    await withdrawConsent('/consent/change')

    expect(deleteLocalData).toHaveBeenCalledOnce()
    expect(readConsent()).toBe('refused')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
    expect(reloadInto).toHaveBeenCalledWith('/consent/change')
  })

  it('keeps the choice and does not reload when deleting fails', async () => {
    setConsent('granted')
    vi.mocked(deleteLocalData).mockRejectedValue(new Error('blocked'))
    await expect(withdrawConsent('/')).rejects.toThrow('blocked')
    expect(readConsent()).toBe('granted')
    expect(reloadInto).not.toHaveBeenCalled()
  })
})
