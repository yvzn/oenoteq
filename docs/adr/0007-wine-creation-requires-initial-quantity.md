---
status: accepted
---

# Wine creation requires and atomically applies an initial quantity

ADR-0006 made `Wine.quantity` delta-only — never set directly by create or update, only moved by Consumption or a manual quantity adjustment. That closed a gap ADR-0006 didn't anticipate: a wine created with no adjustment yet sits at quantity 0, and Search (the app's only wine-browsing view) excludes quantity-0 wines by default with no toggle to see them again — so a wine left unstocked past its own detail page became permanently unreachable through the UI. `CreateWine` now accepts an optional `initial_quantity` (must be ≥1); when present, the same transaction that inserts the Wine row also inserts a `quantity_adjustment` (reason `manual`) applying it, so creation and first stock count either both land or neither does. This isn't a reopening of "quantity settable on create": it's the first delta event happening atomically with creation instead of as a separate, skippable follow-up call.

## Considered Options

- **Two sequential calls** (create the wine, then call the existing `quantity-adjustments` endpoint) — rejected: reproduces the same failure window this decision exists to close, just at smaller odds (dropped connection or closed tab between the two requests still leaves a stuck-at-zero wine).
- **Allow `initial_quantity` of 0** for a wishlist/pre-order use case — rejected: no such concept exists in the domain today (`CONTEXT.md`'s Wine entry describes "quantity on hand," not a want-list), and allowing 0 through this required step just recreates the stuck-at-zero state one validation message away. Revisit if a wishlist/pre-order concept is ever added.

## Consequences

- The existing `POST /wines/{id}/quantity-adjustments` endpoint (ADR-0006 / ticket 03) is unchanged and still the only path for adjustments after creation — restocks, corrections, and offline sync (ticket 05) all go through it. `initial_quantity` only exists on `CreateWine`.
