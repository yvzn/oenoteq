import { db, type LocalDb } from '../db/localDb'

// Everything Offline Mode keeps on the device: the local store (cellar copy and outbox),
// the service worker and its caches. Deleting it silently drops any unsent change, so
// callers confirm that with the user first. Safe to run when none of it exists.
export async function deleteLocalData(store: LocalDb = db): Promise<void> {
  store.close()
  await store.delete()
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  if ('caches' in globalThis) {
    const names = await caches.keys()
    await Promise.all(names.map((name) => caches.delete(name)))
  }
}

// Whether a local store exists, without creating one (opening it would write).
export async function localStoreExists(store: LocalDb = db): Promise<boolean> {
  return (await indexedDB.databases()).some((info) => info.name === store.name)
}
