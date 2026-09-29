# 01: Require and atomically apply an initial quantity on Wine creation

**What to build:** Adding a Wine always requires and immediately applies a starting quantity, atomically with creation (ADR-0007) — a wine can no longer be created and left unreachable at zero stock once the user navigates away from its detail page (Search excludes zero-quantity wines by default and no other view surfaces them). Editing a Wine still never touches quantity, unchanged from ticket 03 (`offline-first-pwa`); its now-dead quantity field is removed from the edit form.

**Blocked by:** None (can start immediately) — builds on the already-implemented ticket 03 (`offline-first-pwa`, `quantity_adjustment` table, ADR-0006 delta model) and ADR-0007.

**Status:** ready-for-agent

- [x] `CreateWine` accepts an `initial_quantity` field; a request with `initial_quantity` missing or `< 1` is rejected
- [x] When valid, the Wine insert and its first `quantity_adjustment` (reason `manual`) commit atomically in the same transaction — both land or neither does
- [x] Add Wine form's existing quantity stepper (already defaults to 1) sends `initial_quantity`; client-side validation enforces `>= 1`
- [x] Edit Wine form no longer shows a quantity field (it was already a no-op there as of ticket 03)
- [x] `api.http` Create Wine examples updated to show `initial_quantity`
- [x] Handler/db tests: valid create applies the initial quantity atomically; create with `initial_quantity` missing or `< 1` is rejected; existing tests updated to the new contract
- [x] Frontend component tests: create flow sends `initial_quantity` and blocks submit below 1; edit form has no quantity field
