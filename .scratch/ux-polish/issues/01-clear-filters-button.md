# 01: Clear-filters button on cellar list

**What to build:** User with multiple filters active (meal/appellation/color/ready-now) on the cellar list, gets a "Clear filters" button next to FilterBar. Clicking resets all filters and returns to the unfiltered list. Button only shows when at least one filter is active.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] "Clear filters" button renders in FilterBar area, visible only when any filter is set (mealId, appellationId, color, readyNow)
- [x] Clicking it resets route query to empty (same pattern as existing `router.push({ query: {} })`), list returns to unfiltered state
- [x] Button hidden again once filters are cleared
