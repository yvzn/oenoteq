# 04: Local-first Wine (Dexie + outbox foundation)

**What to build:** the tracer bullet for the whole offline layer. A local Dexie (IndexedDB) store becomes the read/write source of truth for the UI; a generic outbox module queues mutations and replays them against the backend on reconnect. `useWines` is rebuilt on this foundation. Adding or editing a Wine works fully offline, shows up immediately, and syncs once back online.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Local Dexie store holds Wine records (and whatever shared reference caches Wine display needs, e.g. Appellation/Producer names for read)
- [ ] Generic outbox module: enqueue a mutation, replay queued mutations in FIFO order against the backend, mark each resolved or failed, expose pending/failed state for later UI consumption
- [ ] Outbox creates carry a client-generated `client_id`, using the idempotent-create support from ticket 01
- [ ] Sync pull: on reconnect, fetch current server Wine (and needed reference) state and upsert into the local store
- [ ] `useWines` reads from and writes to the local store instead of calling the API client directly; the API client is now only called from the sync module
- [ ] Add Wine and edit Wine (all fields except quantity, which is out of scope until ticket 03/05) work with the network fully disabled: change appears immediately in the local UI
- [ ] A queued Wine create/edit syncs to the backend automatically once connectivity returns, without user action
- [ ] Existing Wine-related component tests (CellarListView, WineFormView, WineDetailView) pass against the local-store-backed implementation
- [ ] New tests for the outbox module itself: enqueue, successful replay, failed replay leaves the item visible with its error, replaying the same item twice is a no-op
- [ ] `fake-indexeddb` added to the Vitest setup so Dexie-backed tests run without a real browser
