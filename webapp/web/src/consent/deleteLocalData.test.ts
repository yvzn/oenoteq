import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalDb } from '../db/localDb'
import { deleteLocalData, localStoreExists } from './deleteLocalData'

function fakeServiceWorker(unregister: () => Promise<boolean>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: async () => [{ unregister }, { unregister }] },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
})

describe('deleteLocalData', () => {
  it('deletes the store, unregisters every service worker and deletes every cache', async () => {
    const store = new LocalDb('delete-test')
    await store.wines.count()
    expect(await localStoreExists(store)).toBe(true)
    const unregister = vi.fn().mockResolvedValue(true)
    fakeServiceWorker(unregister)
    const deleteCache = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { keys: async () => ['workbox-precache', 'runtime'], delete: deleteCache })

    await deleteLocalData(store)

    expect(await localStoreExists(store)).toBe(false)
    expect(unregister).toHaveBeenCalledTimes(2)
    expect(deleteCache.mock.calls.map(([name]) => name)).toEqual(['workbox-precache', 'runtime'])
  })

  it('is safe when there is no store, service worker or cache API', async () => {
    const store = new LocalDb('never-opened')
    await expect(deleteLocalData(store)).resolves.toBeUndefined()
    expect(await localStoreExists(store)).toBe(false)
  })

  it('checking for a store does not create one', async () => {
    const store = new LocalDb('just-looking')
    expect(await localStoreExists(store)).toBe(false)
    expect(await localStoreExists(store)).toBe(false)
  })
})
