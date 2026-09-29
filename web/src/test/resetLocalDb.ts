import { afterEach } from 'vitest'
import { db } from '../db/localDb'

// The local store is a module-level singleton (it mirrors the one real
// IndexedDB database the app opens), so without this a write in one test
// leaks into the next one's fake-indexeddb backing store.
afterEach(async () => {
  await Promise.all([
    db.wines.clear(),
    db.producers.clear(),
    db.appellations.clear(),
    db.outbox.clear(),
    db.idRemap.clear(),
  ])
})
