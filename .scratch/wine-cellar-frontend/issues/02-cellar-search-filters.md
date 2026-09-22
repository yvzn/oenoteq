# 02: Cellar search & filters

**What to build:** On the same Cellar screen, a cellar owner can narrow the list down with combinable filters to find something to drink for a specific occasion, and can bookmark or share that exact search.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Filter bar on the Cellar screen: meal, appellation, color, "ready now"
- [ ] Filters combine with AND semantics (matches `GET /search`'s behavior)
- [ ] Active filters are reflected in the URL as query params; loading the screen with query params pre-applies those filters; browser back/forward moves between prior filter states
- [ ] Appellation and meal filter fields autocomplete against the full appellation/meal lists (fetched once client-side), narrowing as the user types
- [ ] Wines with quantity 0 excluded by default (matches API default); wines outside their garde window are still shown, flagged with their status, never hidden by a filter
- [ ] Tests cover: filter combination logic, URL query-param round-trip, autocomplete narrowing
