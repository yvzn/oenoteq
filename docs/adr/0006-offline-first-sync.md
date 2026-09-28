---
status: accepted
---

# Offline-first sync: client-side outbox with server-authoritative reconciliation

Phone usage now needs to work with no or intermittent connectivity, so writes go to a local Dexie/IndexedDB store first and queue in an outbox until the phone is back on the home LAN and the backend (single exe, ADR 0002) is reachable; both phone and desktop clients go through this same local-first layer rather than special-casing one as always-online. Wine and Consumption gain a client-generated `client_id` (UUID) as the idempotency key for outbox items — the server keeps its existing `INTEGER PRIMARY KEY` untouched, sidestepping SQLite's UUID-PK index fragmentation and a schema-wide primary-key migration. `Wine.quantity` is never synced as an absolute number from either write path (direct edit or Consumption); both become signed adjustment events that the server sums, because whole-record Last-Write-Wins on an absolute quantity would silently drop a concurrent decrement. Deletes (Wine, Producer, Appellation, Meal, Meal Pairing edges) stay online-only with no offline queueing and no tombstones — the one exception is canceling a Consumption still sitting unsent in the local outbox, which is pure client-side queue bookkeeping and never reaches the server.

## Considered Options

- **UUID primary keys everywhere**, as originally proposed, instead of adding `client_id` alongside the existing integer PK — rejected: touches every FK column across the schema (`wine_id`, `appellation_id`, `meal_id`) and trades a known SQLite performance concern (random UUID PK index fragmentation) for a problem the additive `client_id` column avoids entirely.
- **RxDB** for local storage/replication — rejected: its live multi-master replication protocol solves a peer-to-peer conflict problem this app doesn't have (one authoritative server, single user). Dexie.js is a thinner fit for a hand-rolled outbox.
- **Offline deletes via tombstones** (`deleted_at` + soft delete) — rejected for v1: adds a whole extra sync-protocol shape (tombstone propagation, resurrection guards) for a rarely-needed offline action. Deletes stay online-only using the existing hard-DELETE endpoints unchanged.

## Consequences

- Sync only completes when the phone is on the home Wi-Fi with the PC powered on (ADR 0002) — no VPN/relay is introduced, so away-from-home actions stay queued until then.
- A queued edit can still fail validation on arrival (e.g. it references a Producer deleted online in the meantime); this surfaces as a visible "failed to sync" item with plain-language remediation, not a silent drop.
