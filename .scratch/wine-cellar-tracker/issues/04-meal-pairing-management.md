# 04: Meal Pairing management

**What to build:** The cellar owner can associate one or more Meals with an (appellation, color) pair, and edit that association later (add/remove Meals from the pair). This is the single shared source of pairing suggestions — there is no per-wine override, by design.

**Blocked by:** 02 (Appellation & Meal reference lists)

**Status:** done

- [x] Associate one or more existing Meals with an (appellation, color) pair
- [x] List the Meals currently associated with a given (appellation, color) pair
- [x] Edit the association: add a Meal to the pair, remove a Meal from the pair
- [x] Associating an unknown appellation id, invalid color, or unknown meal id is rejected
- [x] Tests drive all of the above through the real-SQLite HTTP seam

## Comments

Implemented as `POST /meal-pairings` (`CreateMealPairing`), `DELETE /meal-pairings` (`DeleteMealPairing`), `GET /meal-pairings?appellation_id=&color=` (`ListMealPairings` / `db.ListMealsForPairing`). Composite key (appellation_id, color, meal_id) backed by the existing `meal_pairing` table from migration 001; no new migration needed. Create is idempotent (`INSERT OR IGNORE`, tested); Delete validates appellation/color/meal existence symmetrically with Create, then removes idempotently.

Ran `/code-review` (Standards + Spec sub-agents) before committing. Fixed: `DeleteMealPairing` was missing appellation/meal existence checks present on the create path (asymmetric validation bug) — added, plus reject tests for the delete path. Renamed `AddMealPairing`/`RemoveMealPairing`/`ListMealPairing` to `CreateMealPairing`/`DeleteMealPairing`/`ListMealPairings` to match this repo's existing Create/List naming convention. Left the pre-existing unrelated `api.http` producer-name edit alone (predates this ticket's changes).
