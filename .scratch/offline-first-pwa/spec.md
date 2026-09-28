# Wine Cellar — Offline-First PWA

Status: ready-for-agent

## Problem Statement

The cellar owner's primary usage is now their smartphone, often with no or spotty signal (at the table, in the cellar, at a shop with bad reception). The current app (`web/`) is a plain Vue SPA that talks to the API on every read and write — it does nothing without a live connection to the backend, which itself is a single Go exe on a home-LAN PC (**ADR-0002**) that isn't always powered on. There's no way to open the app, look up a wine, add one, or log a drink when offline, and no way to install it as a standalone app on a phone.

## Solution

Convert the frontend into an installable Progressive Web App backed by a local-first data layer: every read and write goes to a local Dexie (IndexedDB) store first, so the UI never waits on the network. Writes that create or change data are also queued in a local outbox and replayed against the backend once the phone is back on the home Wi-Fi and the PC is reachable (**ADR-0002**'s existing reachability model — no VPN/remote-access work is in scope). The backend stays the single authoritative source of truth; conflict handling and the sync protocol follow **ADR-0006** (client-generated `client_id` for idempotent creates, signed quantity-delta events instead of an overwritable `quantity` field, server-assigned timestamps for Last-Write-Wins, and no offline deletes). The existing four screens (Cellar/Search, Wine Detail, Add/Edit Wine, Meal Pairing admin — **`.scratch/wine-cellar-frontend/spec.md`**) keep their shape; this spec changes what's underneath them and adds sync-status/failure surfacing on top.

## User Stories

### Installability & instant load

1. As a cellar owner, I want to add the app to my phone's home screen, so that it opens like a native app rather than a bookmarked browser tab.
2. As a cellar owner, I want the app to open instantly with no signal at all, so that a dead zone in the cellar doesn't block me from looking something up.
3. As a cellar owner, I want a new version of the app to update itself silently the next time I open it, so that I never have to manually clear a stuck cache or reinstall.
4. As a cellar owner, I want an in-progress sync to finish before the app applies an update, so that an update can't strand a queued change mid-flush.

### Offline reads

5. As a cellar owner, I want to see my full cellar list, filters, and search results with no connection, so that I can decide what to open at the table without waiting for a signal.
6. As a cellar owner, I want a wine's detail (consumption history, suggested meals, garde status) available offline, so that I can check a bottle's story before opening it anywhere.
7. As a cellar owner, I want appellation/producer/meal autocomplete to keep working offline, so that adding a wine or logging a consumption doesn't stall waiting on a lookup list.

### Offline writes

8. As a cellar owner, I want to add a new wine while offline, so that a purchase gets recorded the moment I make it, not whenever I'm next home.
9. As a cellar owner, I want to edit an existing wine's fields (garde, millesime, appellation, producer, color) while offline, so that a correction doesn't have to wait for connectivity.
10. As a cellar owner, I want to record a consumption while offline, so that opening a bottle at dinner with no signal still updates my cellar.
11. As a cellar owner, I want to edit a consumption's rating or notes after the fact while offline, so that I can add a tasting note later without needing to be home.
12. As a cellar owner, I want to manually correct a wine's quantity (e.g. a miscount) while offline, so that stock-taking doesn't require connectivity.
13. As a cellar owner, I want to add a new producer or appellation inline while offline (e.g. mid-way through adding a wine), so that an unfamiliar producer doesn't block the whole entry.
14. As a cellar owner, I want to add a meal pairing to an appellation+color while offline, so that a pairing idea I have at the table isn't lost.
15. As a cellar owner, I want every offline write to show up immediately in the UI (list, detail, quantity), so that I'm never staring at a stale number waiting for a sync that hasn't happened yet.

### What stays online-only

16. As a cellar owner, I want deleting a wine, producer, appellation, or meal to require connectivity, so that I don't accidentally lose data with no way to reconcile it once I'm back online.
17. As a cellar owner, I want removing a meal from a pairing to require connectivity, for the same reason.
18. As a cellar owner, I want to be able to cancel a consumption I just logged, as long as it hasn't synced yet, so that a quick "oops, wrong wine" doesn't need me to wait for connectivity first.

### Sync

19. As a cellar owner, I want my queued offline changes to sync automatically once my phone is back on my home Wi-Fi and the server is reachable, so that I don't have to remember to trigger anything manually.
20. As a cellar owner, I want a clear, unmissable banner when I have no network, telling me my changes are still being saved locally and will sync once I'm back online, so that I'm never wondering whether an offline action "worked."
21. As a cellar owner, I want that banner to disappear the instant I'm back online, with no way to dismiss it myself, so that it can never be mistaken for a stale warning I forgot to close.
22. As a cellar owner, I want to tap the offline banner to reach a sync-status page, so that I can see what's actually queued from the same place I was just told about it.
23. As a cellar owner, I want a small header indicator that also opens the sync-status page whenever there's something pending or failed — even while online — so that I can still check in on a sync that's taking a moment, or revisit a past failure, without needing to have been offline first.
24. As a cellar owner, I want that header indicator to disappear once everything's synced clean, so that it doesn't clutter the UI the rest of the time.
25. As a cellar owner, I want the sync-status page to show one pending-count per entity type (Wine, Consumption, Producer, Appellation, Meal, Meal Pairing), so that I get a quick shape of what's outstanding without wading through a raw list.
26. As a cellar owner, I want failed sync items listed on that same page, each with a plain-language reason and a suggested next step, so that pending and failed sync state live in one place instead of two.
27. As a cellar owner, I want to retry or discard a failed sync item from that page, so that one stuck item doesn't block everything else behind it.
28. As a cellar owner, I want a small "not yet synced" badge on a Wine/Producer/Appellation/Meal's own Detail or Edit view when it's still queued, so that I know I'm looking at a locally-held version before it's confirmed by the server.

## Implementation Decisions

- **Local data layer**: Dexie.js over IndexedDB (**ADR-0006** — rejected RxDB, no multi-master replication needed). A new local-storage module mirrors the synced entities (wine, producer, appellation, meal, meal_pairing, consumption) plus a local `outbox` table (queued mutation: local id, entity, action, `client_id`, payload, status `pending`/`failed`, error message, timestamps).
- **Repository seam**: existing composables (`useWines`, `useProducers`, `useAppellations`, `useMeals`, `useMealPairings`, `useSearch`) keep their current public shape but are re-implemented to read from and write to the local Dexie store instead of calling the API client directly. `src/api/client.ts` (the existing HTTP seam) is no longer called from composables — it's used exclusively by the new sync module. This is the one new architectural seam introduced for this feature; components and their existing tests are unaffected.
- **Sync module**: two halves —
  - *Pull*: on reconnect (and periodically while online), fetch the full current server state for reference lists, wines, consumptions, and meal pairings and upsert into Dexie. Full replication each pull, not incremental — dataset is personal-cellar scale, so this stays simple.
  - *Push*: replay queued outbox items against the backend in FIFO order. A successful item is removed from the outbox; a failed one (validation error, e.g. a referenced producer no longer exists) stays visible with its error message and a suggested remediation, and does not block later independent items from being retried.
- **Idempotent creates**: Wine, Consumption, Producer, Appellation, and Meal creation payloads carry a client-generated `client_id` (UUID); the server upserts on `client_id` so a retried push can't double-create a row. Meal Pairing add doesn't need one — its composite key (`appellation_id`, `color`, `meal_id`) already makes `INSERT OR IGNORE` naturally idempotent.
- **Quantity**: dropped from `Wine`'s create/update request body entirely — it is never synced as an absolute number again. Every quantity change is a signed delta the server applies atomically and sums: Consumption creation still implicitly applies a `-1` (guarded by the Consumption's own `client_id`, so a retried push can't double-decrement), and a new explicit "adjust quantity" action/endpoint covers manual corrections (`{client_id, delta, reason: "manual"}`), deduped the same way. `Wine.quantity` becomes a materialized value, not a directly writable field.
- **Conflict resolution**: everything else on Wine/Producer/Appellation/Meal (non-quantity fields) stays whole-record Last-Write-Wins, keyed on a server-assigned `updated_at` set at ingest — not the phone's clock.
- **Deletes stay exactly as they are today**: Wine/Producer/Appellation/Meal delete and Meal Pairing removal remain synchronous, online-only calls to the existing endpoints — no outbox action, no tombstones. The one offline-capable removal is canceling a Consumption still sitting unsent in the local outbox, which never reaches the server since nothing was pushed yet.
- **Schema**: additive migration (`internal/db/migrations/004_...sql`, following the existing `00N_*.sql` convention) — nullable, unique `client_id` column on wine/producer/appellation/meal/consumption; server-managed `updated_at` on wine/producer/appellation/meal/consumption; a small `quantity_adjustment` table (`id`, `wine_id`, `client_id` unique, `delta`, `reason` fixed to `'manual'`, `created_at`) for manual corrections only — Consumption rows already carry their own idempotency and don't need a mirrored ledger row.
- **API contract**: update `api.http` per project convention — Wine create/update payloads drop `quantity`; new manual quantity-adjustment endpoint; Wine/Consumption/Producer/Appellation/Meal create payloads gain an optional `client_id`.
- **PWA**: `vite-plugin-pwa` (workbox), `registerType: 'autoUpdate'`, manifest + icons + standalone display mode. Precache covers the static app shell only (HTML/JS/CSS/icons) — no runtime API-response caching, since the app no longer reads data over the network directly (that only happens inside the sync module now). `devOptions.enabled: false` so the service worker doesn't register in local dev. The app gates applying a pending SW update until the outbox is empty, rather than reloading mid-flush.
- **Offline banner**: styled like the existing success toast (`SuccessToast.vue`/`useSuccessMessage`) but with no dismiss button — visibility is purely reactive to `navigator.onLine` (and a live connectivity check, not just the browser flag), not user-controlled. Text: "No network — changes are saved locally and will sync when you're back online." Clicking it navigates to the new sync-status page.
- **Sync-status page**: new route (e.g. `/sync-status`). Shows one pending-count per entity type (Wine, Consumption, Producer, Appellation, Meal, Meal Pairing) — a count, not a raw item list — plus a failed-items section below it (each with its human-readable error, suggested next step, and retry/discard actions), replacing the earlier "fits within existing screens" plan with a dedicated page since there's now enough surface area (counts + failures) to warrant one.
- **Header indicator**: a small icon/badge linking to the sync-status page, visible only while there's ≥1 pending or failed item (online or offline) — this is the page's only entry point once the offline banner itself has gone (i.e. once back online). Disappears once the outbox is empty and nothing's failed.
- **Per-entity "not yet synced" badge**: shown on a Wine/Producer/Appellation/Meal's own Detail or Edit view (not in list rows) when that record still has a queued create/edit in the outbox.
- **Reachability**: unchanged from **ADR-0002**/**ADR-0006** — sync only completes when the phone is on the home Wi-Fi and the PC is powered on. No VPN/relay/port-forwarding.

## Testing Decisions

- **Sync/outbox module**: new direct unit tests against its public seam (enqueue, replay-success, replay-failure leaves the item visible with its message, replaying twice is a no-op thanks to `client_id`) — not against Dexie internals. This is genuinely new logic with no prior art in the repo, so it establishes the pattern going forward.
- **Composables**: continue to be exercised primarily through the existing view-level component tests (`CellarListView.test.ts` and friends, per **`.scratch/wine-cellar-frontend/spec.md`**), now asserting against the local-store-backed behavior instead of mocked fetch calls.
- **Backend**: extend the existing `internal/test.Harness`-based HTTP integration tests (`internal/handlers/*_test.go`) — idempotent create via repeated `client_id` (second POST returns the same row, doesn't create a duplicate), the quantity-adjustment endpoint (applies a delta, rejects going negative the same way `ErrQuantityZero` does today, is idempotent on retry), and that Wine update no longer accepts/changes `quantity` from its request body.
- **Test infra addition**: jsdom has no native IndexedDB — add `fake-indexeddb` to the Vitest setup (alongside the existing `dialogPolyfill.ts` setup file) so Dexie-backed tests run without a real browser.
- **Not covered by automated tests**: the service worker/manifest itself (no existing SW test infra in this repo) — verified manually via `vite build && vite preview` on a phone, same as any other manual verification step in this project.

## Out of Scope

- Remote/off-LAN reachability (VPN, Tailscale, port-forwarding) for sync — sync stays home-Wi-Fi-only per **ADR-0006**.
- Offline deletes or tombstones for any entity, and offline removal of a meal pairing.
- Multi-master/peer-to-peer replication (e.g. RxDB) — rejected in **ADR-0006**.
- Authentication/login (unchanged — **ADR-0002**).
- Any redesign of the four existing screens beyond adding sync-status/failure surfacing.
- Background periodic sync or push notifications — sync triggers only on app-foreground + connectivity change, not a background service-worker API.
- End-to-end/browser-automation tests (consistent with **`.scratch/wine-cellar-frontend/spec.md`**).

## Further Notes

- This spec's architecture traces directly to **`docs/adr/0006-offline-first-sync.md`** — read that first for the *why* behind the `client_id`/quantity-delta/no-offline-delete choices; this spec is the *what* to build.
- No `CONTEXT.md` changes: none of this changes what Wine/Consumption/etc. mean to the user, only how they're synced underneath.
- Resulted from a grilling session covering network reachability, device topology, source-of-truth model, quantity conflict handling, offline write scope, ID scheme, delete semantics, PWA update rollout, sync failure visibility, and storage engine choice — all decisions above trace to explicit user answers, not assumptions.
