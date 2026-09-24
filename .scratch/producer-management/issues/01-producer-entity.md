# 01: Producer entity, end to end

**What to build:** Producer becomes a proper entity, mirroring the existing Appellation pattern end to end — schema, backend API, and frontend picker — so repeated buys from the same producer reuse one record instead of a retyped string.

**Blocked by:** None (can start immediately)

**Status:** done

## Schema & migration

- [x] New migration file (e.g. `002_producer.sql`, next after `001_init.sql`, applied through the existing `schema_version`-tracked runner in `internal/db/db.go`) creates `producer (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)` — identical shape to `appellation`, no `COLLATE NOCASE`
- [x] Same migration reshapes `wine`: drops `producer TEXT NOT NULL`, adds `producer_id INTEGER NOT NULL REFERENCES producer(id)`. No existing free-text producer values need to survive the cutover (no real production data)

## Backend

- [x] `Producer` struct (`ID int`, `Name string`) in `internal/db/db.go`
- [x] `CreateProducer()`: insert-only, returns `ErrUniqueConstraint` on duplicate name — no upsert/find-or-create, same shape as `CreateAppellation`
- [x] `ListProducers()`: list all, ordered by name, same shape as `ListAppellations`
- [x] Routes `POST /producers` and `GET /producers` in `internal/handlers/handlers.go`, same handler shape as the Appellation routes. No `DELETE`/`PUT` endpoint
- [x] `GetWine`, `ListWines`, `SearchWines`, `CreateWine`, `UpdateWine` (internal/db/db.go) and `wineRequest`/response shapes (internal/handlers/handlers.go) use `producer_id` + a join/lookup to `producer.name`, in place of the old free-text `producer` column — same pattern as the existing Appellation join
- [x] Every existing wine test that constructs a wine with a free-text `producer` (`wine_test.go`, `consumption_test.go`, `search_test.go`) is updated to create/reference a `Producer` row instead
- [x] New backend tests for Producer mirror Appellation's: create-then-list, and duplicate-name-rejected, through the real-SQLite HTTP seam

## Frontend

- [x] New `useProducers.ts` composable mirroring `useAppellations.ts` (load list, `create()` appends to local cache on success)
- [x] `WineFormView.vue` gains a Producer `AutocompleteField` + inline-create mini-form, wired the same way as the existing Appellation field, including the same `Enter`-key precedence rules already resolved for the Appellation/meal autocompletes
- [x] `web/src/domain/wineForm.ts` and `web/src/api/types.ts` move from `producer: string` to a `producerId`/`producer: {id, name}` shape, consistent with how `appellationId`/`appellation` are already modeled
- [x] `WineDetailView.vue` and `CellarListView.vue` display `wine.producer.name` in place of the old `wine.producer` string
- [x] `WineFormView.test.ts`, `WineDetailView.test.ts`, `CellarListView.test.ts`, and `wineForm.test.ts` updated wherever they currently assert against a free-text `producer` value; new `useProducers` test coverage mirrors `useAppellations`'s

## Comments

Implemented end to end and committed (`59ce0e9`, main). 58 Go tests + 114 frontend tests pass; both sides typecheck/build clean.

Two deliberate deviations worth recording:

- Wine's API response embeds `producer: {id, name}` directly (backend `JOIN producer`), so `WineDetailView.vue`/`CellarListView.vue` read `wine.producer.name` with no client-side lookup. This is what the ticket's checklist literally asks for, but it means Producer's wire format now diverges from Appellation's *actual* behavior — Appellation still resolves display names via a client-side `appellationNameById` lookup built from a separately-loaded list, not an embedded object. The ticket's "consistent with how appellationId/appellation are already modeled" line doesn't match current Appellation behavior. Left as-is per the explicit checklist; flagging in case Appellation should later be reconciled to the same embedded-object pattern.
- No dedicated `useProducers.test.ts` was added — `useAppellations.ts` has no dedicated test file either (its coverage lives entirely in the view tests that use it), so `useProducers` mirrors that actual convention rather than the ticket's assumption that such a file exists to mirror.

Also updated `api.http` with Producer's request examples per the repo's API-contract convention (not itemized above, since it predates this ticket's checklist).
