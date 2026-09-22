# 06: Meal Pairing admin

**What to build:** A cellar owner maintains which meals go with a given appellation+color, either as a standalone task or jumping straight there from a wine they're looking at.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] `/meal-pairings` route: pick an appellation and a color, see the meals currently paired with that combination
- [ ] Add a meal to the pairing via autocomplete against the existing meal list (`POST /meal-pairings`); when no match exists, an inline "create new meal" path (`POST /meals`) lets the user proceed without leaving the screen
- [ ] Remove a meal from the pairing (`DELETE /meal-pairings`)
- [ ] Reachable from the app's top-level nav (added in ticket 01's shell)
- [ ] Reachable from Wine Detail via a link that pre-fills the appellation+color via query params, so the user isn't re-picking them
- [ ] Tests cover: listing current pairings, add/remove flows, inline meal-create flow, and query-param pre-fill
