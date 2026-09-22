# 03: Wine Detail (view)

**What to build:** A cellar owner opens a single wine from the Cellar list and sees everything needed to decide whether to drink it or fix a mistake: its full data, what it pairs with, and its drinking history.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `/wines/:id` route renders millesime, appellation, producer, color, garde range, garde status, and quantity
- [ ] Suggested meals for this wine (derived from its appellation+color pairing) are displayed
- [ ] Full consumption history (date, rating, notes) is displayed, ordered by date
- [ ] Each wine in the Cellar list (ticket 01/02) links to its Detail view
- [ ] Loading/error states handled consistently with ticket 01's convention
- [ ] Tests cover: rendering of wine fields, suggested meals, and consumption history from the API response shape
