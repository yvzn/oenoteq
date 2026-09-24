# 05: Manage hub + nav reorg

**What to build:** The top nav becomes "Cellar" + "Manage" (down from "Cellar" + "Meal pairings"). "Manage" opens a hub page linking to Meals, Appellations, and Meal pairings (a Producer link is added later by ticket 06, once Producer management exists). "Meal pairings" is no longer a top-level nav item.

**Blocked by:** 02 (Meal management), 03 (Appellation management)

**Status:** ready-for-agent

- [ ] New `/manage` route with a hub page listing links to: Meals, Appellations, Meal pairings
- [ ] Top nav shows exactly "Cellar" and "Manage" (no "Meal pairings" at top level)
- [ ] Existing Meal Pairing screen and functionality unchanged — only reachable via the hub now
- [ ] No auth/role gating added (app remains single-user, no-auth)
- [ ] Frontend test coverage for the hub page (renders the three links) and for `AppHeader`'s updated nav items
