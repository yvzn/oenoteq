# 04: Meal pairing create-new auto-pairs

**What to build:** User on meal pairings screen who creates a new meal via "Can't find it? Create new meal" gets it paired immediately — one click covers "create this meal" and "pair it with the current appellation/color", no separate "Add meal" click needed afterward.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `submitNewMeal` calls `addPairing` directly after a successful create (using current `appellationId`/`color` selection), instead of only setting `selectedMealId`
- [x] On success, new meal appears in "Currently paired" list without a further manual "Add meal" click
- [x] Existing error handling (create error, pairing mutate error) still surfaces correctly if either step fails
