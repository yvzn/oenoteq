# 05: Wine detail shows suggested meals

**What to build:** A Wine's detail view is enriched with the list of Meals suggested for it, derived automatically from its (appellation, color) via the Meal Pairing lookup — never entered or stored per-wine.

**Blocked by:** 03 (Wine CRUD), 04 (Meal Pairing management)

**Status:** ready-for-agent

- [x] Getting a Wine's detail includes the Meals associated with its (appellation, color) pair
- [x] A Wine whose (appellation, color) has no Meal Pairing entries yet returns an empty suggested-meals list, not an error
- [x] Editing the Meal Pairing for a pair (ticket 04) is reflected immediately in every Wine detail of that pair — no per-wine copy to keep in sync
- [x] Tests drive this through the real-SQLite HTTP seam
