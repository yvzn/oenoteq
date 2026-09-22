# Wine Cellar — Frontend

Status: ready-for-agent

## Problem Statement

The API (`.scratch/wine-cellar-tracker/`) is complete and covers Wine CRUD, Appellation/Meal reference lists, Meal Pairing management, Consumption recording, and combinable search — but there is no usable interface. The Vue app is scaffolded (`web/`) with only a placeholder that fetches and counts wines; the cellar owner cannot yet see, add, edit, or search their cellar, manage pairings, or log a consumption from a browser or phone.

## Solution

A Vue 3 SPA, built on the existing `web/` scaffold, served from the same origin as the API (per **ADR-0002**, embedded into the single Go binary) so there's no CORS or separate-deploy concern. Four screens cover the full API surface: a combined Cellar/Search view as the home screen, a Wine Detail view (suggested meals, consumption history, inline consumption recording), an Add/Edit Wine form (shared between both routes), and a Meal Pairing admin screen. Styled with Tailwind toward a "private sommelier managing a curated collection in a modern luxury notebook" aesthetic.

## User Stories

### Cellar / Search (home screen)

1. As a cellar owner, I want to land on a list of all my wines by default, so that I can see my cellar at a glance without configuring anything.
2. As a cellar owner, I want to filter the list by meal, appellation, color, and "ready now", combinable with AND, so that I can narrow down to what fits an occasion.
3. As a cellar owner, I want each result to show its garde status (too young / ready / past peak) so that I know which wines need attention even when they're not hidden by a filter.
4. As a cellar owner, I want wines with quantity 0 excluded by default, so that I don't see suggestions I can't actually open.
5. As a cellar owner, I want my active filters reflected in the URL, so that I can bookmark or share a specific search and use the browser back button to return to a prior filter state.
6. As a cellar owner, I want appellation and meal filter fields to autocomplete against my existing lists as I type, so that I don't have to scroll a long dropdown.
7. As a cellar owner, I want a link from the list to each wine's detail view, so that I can drill in.
8. As a cellar owner, I want a way to start adding a new wine from this screen, so that it's always reachable.

### Wine Detail

9. As a cellar owner, I want to see a wine's full detail (millesime, appellation, producer, color, garde range, garde status, quantity) so that I can decide whether to drink or edit it.
10. As a cellar owner, I want to see the meals suggested for this wine (derived from its appellation+color pairing) so that I know what to cook.
11. As a cellar owner, I want to see this wine's full consumption history (date, rating, notes) ordered by date, so that I can recall how it tasted before opening another.
12. As a cellar owner, I want to record a new consumption right from this screen (date required, rating and notes optional) without navigating away, so that logging a drink is low-friction.
13. As a cellar owner, I want the displayed quantity to reflect a just-recorded consumption immediately, so that I trust the number on screen.
14. As a cellar owner, I want to be blocked from recording a consumption when quantity is already 0, with a clear reason shown, so that I understand why the action isn't available.
15. As a cellar owner, I want a link to edit this wine, so that I can correct a mistake.
16. As a cellar owner, I want a link to manage the meal pairings for this wine's appellation+color, pre-filled so I don't have to re-pick them, so that refining suggestions is a short hop from the wine I'm looking at.

### Add / Edit Wine

17. As a cellar owner, I want to add a new wine with millesime (optional), appellation, producer, color, garde range, and quantity, so that I can record a purchase.
18. As a cellar owner, I want to edit any field of an existing wine via the same form, pre-filled with its current values, so that corrections use one consistent UI.
19. As a cellar owner, I want to pick the appellation via autocomplete against the existing list rather than free text, so that meal pairing lookups stay consistent.
20. As a cellar owner, I want to create a brand-new appellation inline, right from the autocomplete, when the one I need doesn't exist yet, so that I'm never blocked mid-form.
21. As a cellar owner, I want color restricted to a fixed choice of rouge/blanc/rose, so that I can't enter an invalid value.
22. As a cellar owner, I want basic validation (required fields, garde_debut ≤ garde_fin, quantity ≥ 0) before the form submits, so that I get fast feedback instead of a rejected API call.
23. As a cellar owner, I want to land back on the wine's detail view after a successful add or edit, so that I can confirm what I just saved.

### Meal Pairing admin

24. As a cellar owner, I want to pick an appellation and a color, so that I can manage the list of meals paired with that combination.
25. As a cellar owner, I want to see the meals currently paired with the selected appellation+color, so that I know the current state before changing it.
26. As a cellar owner, I want to add a meal to the pairing via autocomplete against the existing meal list, so that pairing stays consistent with reference data.
27. As a cellar owner, I want to create a brand-new meal inline when the one I want isn't in the list yet, so that I'm not blocked mid-task.
28. As a cellar owner, I want to remove a meal from a pairing, so that I can correct a suggestion that doesn't fit.
29. As a cellar owner, I want this screen reachable from a top-level nav link, so that I can manage pairings independent of any specific wine.

### Cross-cutting

30. As a cellar owner, I want the whole app usable on my phone's browser, so that I can look things up at the table or in the kitchen.
31. As a cellar owner, I want a consistent way to see loading and error states across screens, so that a slow or failed request is never silently blank.

## Implementation Decisions

- **Routing**: add `vue-router` (not currently a dependency). Routes: `/` (Cellar/Search, filters as query params), `/wines/new` (Add), `/wines/:id` (Detail), `/wines/:id/edit` (Edit, same form component as Add), `/meal-pairings` (optionally pre-filled via query params `appellation_id`/`color` when linked from Detail).
- **Styling**: Tailwind CSS, added to the existing Vite scaffold. Visual direction: "a private sommelier managing a curated collection in a modern luxury notebook" — no specific component library.
- **State**: composables per resource (`useWines`, `useAppellations`, `useMeals`, `useMealPairings`, `useSearch`), each wrapping fetch calls and exposing reactive state. No Pinia/global store — nothing needs cross-screen sharing beyond what a route param or query already carries.
- **API client seam**: a single `src/api/client.ts` (thin fetch wrapper: base path, JSON parsing, error normalization) is the one seam every composable goes through — prefer extending this over adding ad hoc `fetch` calls in components, following the existing dev-proxy convention in `vite.config.ts` (extend the proxy for `/appellations`, `/meals`, `/meal-pairings`, `/search` alongside the existing `/wines` and `/health` entries).
- **Types**: hand-written in `src/api/types.ts`, mirroring the JSON shapes in `api.http` (superseding the inline `Wine` interface currently in `App.vue`). No client generation from the Go structs.
- **Autocomplete**: appellations and meals are fetched in full once per session (no new search/typeahead endpoints — lists are small for a personal cellar) and filtered client-side as the user types.
- **Inline reference-data creation**: both the appellation field (wine form) and the meal field (pairing admin) support creating a new entry inline via `POST /appellations` / `POST /meals` when no existing match is selected, without leaving the current form.
- **Consumption recording**: inline form on Wine Detail (not a separate route) — `POST /wines/:id/consumptions`, then refetch the wine detail so quantity and consumption history reflect the new state.
- **Garde Status**: newly captured in `CONTEXT.md` as a derived (`too_young`/`ready`/`past_peak`) value — display as a badge/flag on both the Cellar list and Wine Detail, never used to hide a result.
- **Deployment fit**: no changes needed to `vite.config.ts`'s dev-proxy-per-path pattern beyond adding the new API paths; production build continues to be embedded per **ADR-0002** with no separate origin, so no CORS handling is needed in the API client.

## Testing Decisions

- **Seam**: component-level tests via Vitest + Vue Test Utils. A good test mounts a component (or exercises a composable directly) and asserts on rendered output / emitted events / composable return values as a consumer would use them — never on internal implementation details (private refs, call counts on internals).
- **Modules tested through this seam**: each composable (`useWines`, `useAppellations`, `useMeals`, `useMealPairings`, `useSearch` — request/response handling, error states), the four screen components (rendering, filter/query-param round-trip on Cellar, inline-create flows, form validation on Add/Edit, garde-status display), and the shared API client (`client.ts` — error normalization).
- **Prior art**: none in the frontend yet — this spec establishes the pattern. Mirrors the backend's existing standard of testing through the outermost seam rather than internals (see `.scratch/wine-cellar-tracker/spec.md`'s Testing Decisions for the equivalent backend precedent).
- **Out of loop**: no Playwright/e2e — judged not worth the maintenance cost for a personal single-user app (per grilling session).

## Out of Scope

- End-to-end/browser-automation tests (Playwright or similar).
- Deleting a Wine record outright, or editing/deleting a past Consumption (both already out of scope on the API side — see `.scratch/wine-cellar-tracker/spec.md`).
- Per-bottle identity or storage/bin location in the UI (no such concept exists in the API — **ADR-0001**).
- Authentication/login UI (none — single implicit user, **ADR-0002**).
- Offline support / PWA installability.
- Any change to the API contract itself (this spec only consumes the existing endpoints in `api.http`).

## Further Notes

- Domain vocabulary (Wine, Millesime, Garde, Garde Status, Appellation, Color, Meal Pairing, Consumption) is defined in `CONTEXT.md` at the repo root — use those terms, not synonyms, throughout implementation.
- This spec resulted from a grilling session with the user covering screen scope, styling direction, state management, autocomplete data source, meal-pairing UI shape, inline reference-data creation, routing/URL structure, and testing strategy — all decisions above trace back to explicit user answers, not assumptions.
- The existing `web/src/App.vue` placeholder (fetch-and-count wines) is expected to be replaced entirely by the router + screens described above.
