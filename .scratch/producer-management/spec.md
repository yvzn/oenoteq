# Producer Management

Status: ready-for-agent

## Problem Statement

Producer is currently a free-text field re-typed on every Wine. The same real-world producer ends up spelled slightly differently across entries (case, whitespace, typos), and there is no way to see or query "everything from this producer" or reuse a prior entry when buying more from a producer already in the cellar.

## Solution

Introduce Producer as its own entity, mirroring the existing Appellation pattern exactly: a `producer` table (`id`, `name` unique), a `POST /producers` (insert-only, name required, duplicate name rejected) and `GET /producers` endpoint, and a `producer_id` foreign key on Wine replacing the free-text `producer` column. On the Add/Edit Wine form, Producer is picked via the same searchable-autocomplete-with-inline-create component already used for Appellation, so a repeated buy from a known producer is a pick, not a retype.

## User Stories

### Selection

1. As a cellar owner, I want to pick a Producer from a searchable list on the Add/Edit Wine form, so a repeated buy from a producer already in my cellar reuses the exact same record instead of a fresh retype.
2. As a cellar owner, I want the Producer list to filter as I type, case-insensitively, so I can find an existing producer quickly, including on a phone.
3. As a cellar owner, I want the full Producer list loaded once per form visit and filtered locally rather than searched over the network per keystroke, since my Producer list stays small.

### Creation

4. As a cellar owner, I want to create a new Producer inline from the Add/Edit Wine form when none of the existing ones match what I typed, so I never have to leave the form to add one.
5. As a cellar owner, I want creating a Producer whose name already exists (exact match) to be rejected rather than silently duplicated, so my Producer list doesn't drift into near-duplicates through repeated form use.

### Data integrity

6. As a cellar owner, I want each Wine to reference one Producer record rather than store free text, so every wine bought from the same producer stays linked to the same underlying record.

## Implementation Decisions

- **New `producer` table**, identical shape to the existing `appellation` table: `id INTEGER PRIMARY KEY`, `name TEXT NOT NULL UNIQUE` (no `COLLATE NOCASE` — matches Appellation's existing case-sensitive uniqueness exactly; a `producer_id` FK dedupes the vast majority of repeat-purchase cases, so no case-insensitive constraint is added even though Producer is new).
- **New migration file** (e.g. `002_producer.sql`, next after `001_init.sql` per the `schema_version`-tracked migration runner in `internal/db/db.go`) creates the `producer` table and reshapes `wine`: drops the `producer TEXT NOT NULL` column, adds `producer_id INTEGER NOT NULL REFERENCES producer(id)`. No production data needs to survive the cutover (confirmed: no real existing data), so the migration does not need to preserve/backfill prior free-text producer values — SQLite's table-rebuild pattern (create new `wine` shape, copy non-producer columns, drop old, rename) is fine, or a fresh-schema approach if simpler; either way `producer_id` ends up `NOT NULL`.
- **Backend model/endpoints**, mirroring `Appellation`/`CreateAppellation`/`ListAppellations` in `internal/db/db.go` and their handlers in `internal/handlers/handlers.go`:
  - `Producer` struct (`ID int`, `Name string`)
  - `CreateProducer()`: insert-only, returns the same duplicate-name error (`ErrUniqueConstraint`) as `CreateAppellation` on conflict — no upsert-by-name, no find-or-create.
  - `ListProducers()`: list all, ordered by name.
  - Routes: `POST /producers`, `GET /producers`.
  - No `DELETE`/`PUT` endpoint for Producer (Appellation has none either).
- **Wine read/write paths** (`GetWine`, `ListWines`, `SearchWines`, `CreateWine`, `UpdateWine` in `internal/db/db.go`, and `wineRequest`/response shapes in `internal/handlers/handlers.go`) swap the `producer` string column for `producer_id`, joining to `producer` for the display name the same way the existing appellation join/lookup works.
- **Frontend**: new `useProducers.ts` composable mirroring `useAppellations.ts` (load list, `create()` appends to local cache on success). `WineFormView.vue` gains a Producer `AutocompleteField` + inline-create mini-form, wired the same way as the existing Appellation field (including the same `Enter`-key precedence resolved in the autocomplete keyboard-nav work). `web/src/domain/wineForm.ts` and `web/src/api/types.ts` change from `producer: string` to a `producerId`/`producer: {id, name}` shape consistent with how `appellationId`/`appellation` are already modeled. `WineDetailView.vue` and `CellarListView.vue` display `wine.producer.name` in place of `wine.producer`.

## Testing Decisions

- Backend: extend `internal/db` and `internal/handlers` tests the same way Appellation is tested today — create-then-list, and the duplicate-name-rejected case, through the real-SQLite HTTP seam. Update every existing wine test (`wine_test.go`, `consumption_test.go`, `search_test.go`) that currently constructs a wine with a free-text `producer` to instead create/reference a `Producer` row.
- Frontend: extend `useProducers.test.ts`-style coverage mirroring `useAppellations`, and update `WineFormView.test.ts`, `WineDetailView.test.ts`, `CellarListView.test.ts`, and `wineForm.test.ts` wherever they currently assert against a free-text `producer` value.

## Out of Scope

- Renaming or deleting a Producer (no `PUT`/`DELETE` endpoint, no dedicated management page) — same posture as Appellation today.
- A dedicated Producer list/management screen.
- Multiple producers per Wine (co-productions/negociant blends) — strict one Producer per Wine.
- Per-user Producer scoping (app remains single-user; Producer is a global table like Appellation).
- Case-insensitive uniqueness or fuzzy-duplicate detection on Producer names.
- Preserving/backfilling existing free-text producer values (none exist in real data).
- Wiring Producer into Label Scan's autocomplete-matching behavior (Label Scan currently prefills Producer as plain text per `CONTEXT.md`/the Label Scan spec; reconciling that with the new entity is a follow-up, not part of this feature).

## Further Notes

- `CONTEXT.md` already updated: Producer's definition changed from "free-text name" to "a named entity ... referenced by Wine ... same convention as Appellation."
- This spec resulted from a grilling session covering scope (global/single-user), fields (name-only), cardinality (strict 1:1), migration posture (no real data to preserve), uniqueness (case-sensitive, matching Appellation), creation flow (mirrors Appellation's explicit insert-only endpoint, not a backend upsert), and out-of-v1-scope items (rename, delete, dedicated page) — all decisions above trace back to explicit user answers or the existing Appellation convention discovered during the session, not assumptions.
- No ADR was written for this change: it applies an already-established pattern (Appellation-as-entity) rather than introducing a new architectural trade-off, so it doesn't meet the "surprising without context" bar for an ADR.
