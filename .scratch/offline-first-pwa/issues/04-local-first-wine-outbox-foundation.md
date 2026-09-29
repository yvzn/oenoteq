# 04: Local-first Wine (Dexie + outbox foundation)

**What to build:** the tracer bullet for the whole offline layer. A local Dexie (IndexedDB) store becomes the read/write source of truth for the UI; a generic outbox module queues mutations and replays them against the backend on reconnect. `useWines` is rebuilt on this foundation. Adding or editing a Wine works fully offline, shows up immediately, and syncs once back online.

**Blocked by:** 01

**Status:** done

- [x] Local Dexie store holds Wine records (and whatever shared reference caches Wine display needs, e.g. Appellation/Producer names for read)
- [x] Generic outbox module: enqueue a mutation, replay queued mutations in FIFO order against the backend, mark each resolved or failed, expose pending/failed state for later UI consumption
- [x] Outbox creates carry a client-generated `client_id`, using the idempotent-create support from ticket 01
- [x] Sync pull: on reconnect, fetch current server Wine (and needed reference) state and upsert into the local store
- [x] `useWines` reads from and writes to the local store instead of calling the API client directly; the API client is now only called from the sync module
- [x] Add Wine and edit Wine (all fields except quantity, which is out of scope until ticket 03/05) work with the network fully disabled: change appears immediately in the local UI
- [x] A queued Wine create/edit syncs to the backend automatically once connectivity returns, without user action
- [x] Existing Wine-related component tests (CellarListView, WineFormView, WineDetailView) pass against the local-store-backed implementation
- [x] New tests for the outbox module itself: enqueue, successful replay, failed replay leaves the item visible with its error, replaying the same item twice is a no-op
- [x] `fake-indexeddb` added to the Vitest setup so Dexie-backed tests run without a real browser

## Comments

- Scope: only `useWines`'s `load`/`create`/`update` (the Wine CRUD path) were rebuilt on the local store + outbox. `useWines`'s consumption methods (`recordConsumption`/`updateConsumption`/`deleteConsumption`) still call the API client directly — offline consumption is ticket 05. `useSearch`/`useMeals`/`useMealPairings` are untouched — ticket 06. `useAppellations`/`useProducers` did get a local read-through cache + offline fallback, since `useWines` needs a Producer to embed in an offline-created Wine record, and Add/Edit Wine's own dropdowns need to survive a fully-disabled network too.
- A network error (`ApiError` status 0) during outbox replay leaves the item `pending` (silent retry on next reconnect) rather than `failed` — `failed` is reserved for a real server rejection (e.g. a referenced producer no longer existing), per the spec's own distinction between "no network yet" and "this item was rejected."
- Offline-created wines get a negative, client-only id until their create syncs and the local record is replaced by the server-assigned one; editing such a wine again before it syncs folds the edit into the still-pending create payload instead of queuing a doomed update against a server id that doesn't exist yet.
