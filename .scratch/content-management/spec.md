# Content Management (Meal, Appellation, Producer, Consumption)

Status: ready-for-agent

## Problem Statement

The front-end offers no forgiveness for mistakes and no way to fix them. Meal, Appellation, and Producer names can only ever be created (typo'd once, stuck forever), never renamed or removed. Consumption entries — the record of drinking a Wine — can be created but never edited or deleted, so a wrong date, rating, or misclick during recording is permanent. There's also no place in the navigation for this kind of housekeeping work without cluttering the primary "Cellar" flow.

## Solution

Add rename/delete management for Meal, Appellation, and Producer, each behind a small dedicated page, plus inline edit/delete for Consumption entries on the Wine detail page. Group all of this — plus the existing Meal Pairing screen — behind a new "Manage" entry in the top nav, replacing "Meal pairings" as a top-level item. Deletes are blocked (not cascaded) when the target is still referenced elsewhere, and always require confirmation via one new shared confirm dialog.

Producer management is delivered in two sequential efforts. A separate, already-groomed spec (`.scratch/producer-management/spec.md`, status `ready-for-agent`) turns Producer from a free-text field into a real entity but explicitly excludes rename/delete/a management page. This spec's Producer Management section is the second effort: it is **blocked on that other spec shipping first**, since it needs the `producer` table and `producer_id` FK to exist.

## User Stories

### Meal management

1. As a cellar owner, I want to see a list of all Meals, so that I can find the one I need to fix.
2. As a cellar owner, I want to rename a Meal, so that I can correct a typo or misclick without recreating my Meal Pairings around it.
3. As a cellar owner, I want to delete a Meal that's no longer useful, so that my Meal list doesn't accumulate junk.
4. As a cellar owner, I want deleting a Meal that's still used in a Meal Pairing to be blocked with a clear message, so that I don't silently lose a pairing.
5. As a cellar owner, I want to confirm before a Meal is actually deleted, so that a misclick doesn't destroy something I meant to keep.
6. As a cellar owner, I want to create a new Meal from the management page (not only inline from the Meal Pairing screen), so that I have one consistent place to manage Meals.

### Appellation management

7. As a cellar owner, I want to see a list of all Appellations, so that I can find the one I need to fix.
8. As a cellar owner, I want to rename an Appellation, so that I can correct a typo or misclick without touching every Wine that references it.
9. As a cellar owner, I want to delete an Appellation that's no longer useful, so that my Appellation list doesn't accumulate junk.
10. As a cellar owner, I want deleting an Appellation that's still used by a Wine or a Meal Pairing to be blocked with a clear message, so that I don't silently orphan a Wine or lose a pairing.
11. As a cellar owner, I want to confirm before an Appellation is actually deleted, so that a misclick doesn't destroy something I meant to keep.
12. As a cellar owner, I want to create a new Appellation from the management page (not only inline from the Add/Edit Wine form), so that I have one consistent place to manage Appellations.

### Producer management (blocked on the Producer-as-entity spec)

13. As a cellar owner, I want to see a list of all Producers, so that I can find the one I need to fix.
14. As a cellar owner, I want to rename a Producer, so that I can correct a typo or misclick without touching every Wine that references it.
15. As a cellar owner, I want to delete a Producer that's no longer useful, so that my Producer list doesn't accumulate junk.
16. As a cellar owner, I want deleting a Producer that's still used by a Wine to be blocked with a clear message, so that I don't silently orphan a Wine.
17. As a cellar owner, I want to confirm before a Producer is actually deleted, so that a misclick doesn't destroy something I meant to keep.
18. As a cellar owner, I want to create a new Producer from the management page (not only inline from the Add/Edit Wine form), so that I have one consistent place to manage Producers.

### Consumption entry edit/delete

19. As a cellar owner, I want to edit a Consumption entry's date, rating, or notes, so that I can fix a mistake made when recording it.
20. As a cellar owner, I want the edit form to appear inline in the Consumption history list, so that I don't leave the Wine detail page to fix a small mistake.
21. As a cellar owner, I want to delete a Consumption entry, so that I can remove one recorded by mistake (e.g. against the wrong Wine).
22. As a cellar owner, I want to confirm before a Consumption entry is actually deleted, so that a misclick doesn't destroy drinking history.
23. As a cellar owner, I want deleting a Consumption entry to restore the Wine's quantity by one, so that the stock count stays accurate after undoing a mistaken entry.
24. As a cellar owner, when I got the Wine wrong on a Consumption entry, I want to delete it and record a fresh one against the correct Wine, so that history stays accurate (re-linking an existing entry to a different Wine is not supported).

### Navigation

25. As a cellar owner, I want a single "Manage" entry in the top nav, so that housekeeping screens (Meals, Appellations, Producers, Meal pairings) don't clutter the primary Cellar-focused nav.
26. As a cellar owner, I want the "Manage" entry to open a hub page linking to Meals, Appellations, Producers, and Meal pairings, so that I have one starting point for all management tasks.
27. As a cellar owner, I want "Meal pairings" removed from the top-level nav (now reachable only via Manage), so that the top nav stays down to Cellar + Manage.

## Implementation Decisions

### Data & API — Meal

- New `UpdateMeal(id, name)` and `DeleteMeal(id)` methods on `internal/db.DB`, mirroring the existing `CreateMeal`/`ListMeal` shape and duplicate-name error handling.
- `DeleteMeal` checks for any `meal_pairing` row referencing the Meal first; if found, returns a distinct "in use" error rather than performing the delete. Do not rely on SQLite foreign keys for this (FK enforcement is off repo-wide; there's no `ON DELETE` behavior to lean on) — this must be an explicit query-then-check in the handler/DB layer.
- New routes `PUT /meals/{id}` and `DELETE /meals/{id}`, following the existing route registration style in `internal/handlers/handlers.go`.
- Rename rejects on duplicate name, same as create.

### Data & API — Appellation

- Same shape as Meal: `UpdateAppellation(id, name)`, `DeleteAppellation(id)`, routes `PUT /appellations/{id}` and `DELETE /appellations/{id}`.
- `DeleteAppellation` checks both `wine.appellation_id` and `meal_pairing.appellation_id` for references before deleting; either one blocks the delete with an "in use" error.

### Data & API — Producer (blocked on the Producer-as-entity spec landing)

- Same shape again, once the `producer` table and `producer_id` FK on `wine` exist: `UpdateProducer(id, name)`, `DeleteProducer(id)`, routes `PUT /producers/{id}` and `DELETE /producers/{id}`.
- `DeleteProducer` checks `wine.producer_id` for references before deleting.
- This section supersedes the "no rename/delete/dedicated page" out-of-scope note in `.scratch/producer-management/spec.md` — that spec still ships as originally written; this is the follow-up that extends it.

### Data & API — Consumption

- New `UpdateConsumption(id, date, rating, notes)` and `DeleteConsumption(id)` methods on `internal/db.DB`. `wine_id` is immutable — there is no re-linking to a different Wine.
- New routes, e.g. `PUT /consumptions/{id}` and `DELETE /consumptions/{id}` — Consumption is addressed by its own id for edit/delete, distinct from the existing `POST /wines/{id}/consumptions` create route which stays nested under Wine.
- `UpdateConsumption` re-validates date/rating exactly as `CreateConsumption` does today (date required and parseable, rating optional 1-5).
- `DeleteConsumption` increments the referenced Wine's `quantity` by one (the inverse of the decrement that happens on creation).

### Delete confirmation

- One new shared `ConfirmDialog` component (none exists in the codebase today). Used for all four delete actions: Meal, Appellation, Producer, Consumption. Not used to retrofit Meal Pairing's existing immediate-delete "Remove" button (out of scope, see below).

### Frontend pages

- New `MealListView` / `AppellationListView` / `ProducerListView` (Producer view built in the second, blocked effort), each: lists entities, links to create, links to rename per-row, delete button per row wired to `ConfirmDialog`, and surfaces the backend's "in use" error inline on a blocked delete attempt.
- Create/rename share one form component per entity (mirroring `WineFormView`'s `isEdit` + prefill-via-watch pattern) rather than separate create and edit components.
- Reuse existing shared components throughout: `PageHeader`, `FormField`, `AppButton`, `StatusLine` (loading/error/retry), and the `useSuccessMessage` composable for post-mutation toast + redirect.
- Consumption history rows on `WineDetailView` gain per-row Edit/Delete actions. Edit expands the row into an inline form (date/rating/notes) rather than navigating away, mirroring how "record a consumption" is already embedded on that same page.

### Navigation

- New `useManage`-less hub page (e.g. `/manage`), a new route, listed in `web/src/router/index.ts` alongside the others. Hub page is a simple list/cards of links to: Meals, Appellations, Producers, Meal pairings.
- `AppHeader.vue`'s nav array changes from `[Cellar, Meal pairings]` to `[Cellar, Manage]`. The Meal pairings link moves from the nav bar into the hub page.
- No auth/role gating on any new route — the app is single-user with no auth system.

### API contract

- Per this repo's convention (`AGENTS.md`), every new/changed endpoint gets a matching request added to `api.http`: `PUT`/`DELETE` for `/meals/{id}`, `/appellations/{id}`, `/producers/{id}` (second effort), and `/consumptions/{id}`.

## Testing Decisions

Tests target external behavior (HTTP status + JSON body for backend, rendered DOM/behavior for frontend), not internal call structure — following the two seams already established in this codebase:

- **Backend seam**: `internal/handlers` tests via `test.Harness`, hitting a real SQLite instance through the real HTTP routes (the same seam `consumption_test.go`, `wine_test.go`, and `meal_pairing_test.go` already use). Cover, per entity: successful rename, duplicate-name-rejected rename, successful delete, blocked-delete-when-referenced (one test per referencing table — e.g. Appellation blocked by Wine, and separately by Meal Pairing), and delete/rename of a nonexistent id (404). For Consumption: successful edit of each field, edit validation reusing the same rules as create, successful delete, delete restoring Wine quantity, and edit/delete of a nonexistent id (404).
- **Frontend seam**: mount the relevant View with `apiClient` mocked (`get`/`post`/`put`/`delete`) and a memory router, asserting rendered output and interactions — the same seam `WineFormView.test.ts`, `WineDetailView.test.ts`, and `MealPairingView.test.ts` already use. Cover: list rendering, rename flow, delete confirmation flow (dialog appears, cancel does nothing, confirm calls the API), blocked-delete error surfaced to the user, and the inline Consumption edit/delete flow on `WineDetailView`.
- `ConfirmDialog` gets its own focused component test (open/cancel/confirm behavior) rather than being re-tested in full from every caller.

## Out of Scope

- Everything already out of scope in `.scratch/producer-management/spec.md` (multi-producer wines, case-insensitive uniqueness, Label Scan integration, data backfill) remains out of scope here too.
- Re-linking a Consumption entry to a different Wine — delete and re-create instead.
- Cascade delete or soft-delete/archive for Meal, Appellation, or Producer — delete is strictly blocked when referenced.
- Adding new fields to Meal, Appellation, or Producer (e.g. description, region) — rename is the only edit.
- Retrofitting the existing Meal Pairing "Remove" button to use the new `ConfirmDialog` — it keeps its current immediate-delete behavior; only the four flows listed above get confirmation.
- Any auth/permission gating on the new pages.
- Bulk operations (bulk delete, bulk rename, merge-duplicate-entities).

## Further Notes

- `CONTEXT.md` was updated in the grilling session that produced this spec: added a **Meal** glossary entry (a standalone named dish/food category, usable in a Meal Pairing, valid even with zero pairings attached).
- The Producer Management section of this spec is blocked on `.scratch/producer-management/spec.md` shipping first. When decomposed into tickets, that dependency should be recorded explicitly rather than assumed from reading order.
- No ADR needed: none of the decisions here introduce a new architectural trade-off — restrict-on-delete and the shared confirm dialog are conventions applied uniformly, not one-off judgment calls with competing alternatives.
