# 06: Offline CRUD for Producer/Appellation/Meal + offline add Meal Pairing

**What to build:** the outbox pattern from ticket 04 extended to Producer, Appellation, and Meal (create and edit), and to adding a Meal Pairing edge. Deletes and pairing-removal are untouched — they stay online-only, exactly as they work today.

**Blocked by:** 04

**Status:** done

- [x] `useProducers`, `useAppellations`, `useMeals` rebuilt on the local store + outbox, same pattern as `useWines` from ticket 04
- [x] Creating and editing a Producer, Appellation, or Meal works fully offline, appears immediately, syncs on reconnect, idempotent via `client_id`
- [x] Inline reference-data creation (e.g. creating a new Appellation mid-way through the Wine form) works offline
- [x] Adding a Meal Pairing (appellation + color + meal) works offline, queued via the outbox; add is naturally idempotent on retry via the existing composite key (no `client_id` needed for this one)
- [x] Removing a Meal Pairing, and deleting a Producer/Appellation/Meal/Wine, all still require connectivity — no offline queueing for any of these, unchanged from today's behavior
- [x] Component tests updated/added for offline create+edit across Producer/Appellation/Meal views and offline Meal Pairing add

## Comments

- New per-entity sync modules (`producerSync.ts`, `appellationSync.ts`, `mealSync.ts`, `mealPairingSync.ts`) mirror `wineSync.ts`'s handler/enqueue/patchPendingCreate/push/pull shape. `nextLocalId` and the `resolveSyncedId` idRemap lookup were extracted into shared `db/localId.ts`/`sync/idRemap.ts` so Wine (which references Producer/Appellation) and Meal Pairing (which references Appellation/Meal) can resolve another entity's not-yet-synced negative id the same way Consumption already resolves a not-yet-synced Wine id.
- `wineSync.ts`'s create/update payload now resolves `appellation_id`/`producer_id` through `resolveSyncedId` before every push, since either can be a still-offline reference created inline mid-Wine-form; an unresolved reference leaves the Wine's own create/update `pending` (retryable), not `failed`.
- Meal Pairing `add` has no per-entity Dexie table of its own beyond a small `mealPairings` read-through cache (keyed `[appellationId+color+mealId]`) used to reflect an offline add immediately and to cache the last-fetched pairing list per appellation+color for offline fallback — there's no bulk "list all pairings" endpoint to support full replication the way Wine/Producer/Appellation/Meal get it.
- Found and fixed a real race while wiring this up: two composable mutations firing back-to-back in the same handler (e.g. `MealPairingView`'s "create a new Meal, then immediately pair it") each kick off their own background push pass; without a guard, both scans could see the same still-pending outbox item and post it twice before either had deleted it. Fixed by having `outbox.ts`'s `replay()` atomically claim an item (`pending` -> `in-flight`, inside a transaction) before handling it, rather than a module-level lock — a lock would've had the same problem as this bug's root cause but at a coarser scale (one hung request blocking every future push for every entity).
- Producer/Appellation/Meal create/update no longer call the API client directly — like Wine, they go through the local store + outbox now, so `apiClient.post`/`put` calls in tests happen via the background push rather than synchronously inside the composable call. A rejected background push (including a genuine network error) no longer blocks navigation or shows an inline form error — it just leaves the item `failed`/`pending` in the outbox (surfaced later on the sync-status page, ticket 07), matching Wine/Consumption's existing behavior.
