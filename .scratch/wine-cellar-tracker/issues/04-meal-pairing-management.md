# 04: Meal Pairing management

**What to build:** The cellar owner can associate one or more Meals with an (appellation, color) pair, and edit that association later (add/remove Meals from the pair). This is the single shared source of pairing suggestions — there is no per-wine override, by design.

**Blocked by:** 02 (Appellation & Meal reference lists)

**Status:** ready-for-agent

- [ ] Associate one or more existing Meals with an (appellation, color) pair
- [ ] List the Meals currently associated with a given (appellation, color) pair
- [ ] Edit the association: add a Meal to the pair, remove a Meal from the pair
- [ ] Associating an unknown appellation id, invalid color, or unknown meal id is rejected
- [ ] Tests drive all of the above through the real-SQLite HTTP seam
