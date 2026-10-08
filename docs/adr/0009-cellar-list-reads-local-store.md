---
status: accepted
---

# Cellar list reads from the local store, not the server `/search` endpoint

The cellar list must work offline and reflect offline writes (ADR 0006), so it reads Wines from the local Dexie store — online and offline — and mirrors the server's filter, sort and Garde Status logic client-side; the server `/search` endpoint stays as the API but the list page no longer calls it. The local store is refreshed by a background push-then-pull (app start, reconnect, list open, return to foreground, manual retry) and the list updates in place. Pagination is a client-side slice of the full result, which is small (a cellar tops out around 100 in-stock Wines).

## Considered Options

- **Service worker `NetworkFirst` cache of `/search` responses** — rejected: a cached response is a server snapshot, so a Consumption or a Wine created offline (already in the local store and outbox) wouldn't show in the list, and the list would disagree with the detail page. Queries never visited online would also miss the cache, including on a cold offline start.
- **Server `/search` online, local store only as offline fallback** — rejected: two code paths that must stay identical for the same page, with the online path hiding any client-side divergence until the user goes offline.
- **Local store first, replace with the `/search` result when it arrives** — rejected: visible flicker and reordering on every load.

## Consequences

- Amended by ADR 0010: this applies only while Offline Mode is on (Storage Consent granted). Without it, the list calls `/search` and paginates the result client-side.

- Filter, sort and Garde Status logic exist twice (Go and TypeScript). Parity tests run the same fixtures against both; ordering is plain binary string comparison, matching SQLite's default.
- The meal filter needs every Meal Pairing locally, so a bulk pairings pull joins the sync.
- More frequent pulls make the stale-overwrite race (a pull replacing a Wine that still has a pending outbox update) much easier to hit, so pulls must not overwrite Wines with pending outbox items.
