# 06: Clickable appellation/garde badge on cellar card

**What to build:** User browsing the cellar list can click a card's appellation name to filter the list by that appellation, or click the garde-status badge to filter to "ready now" — without triggering the card's own link to wine detail.

**Blocked by:** None (can start immediately)

**Status:** wont-implement

- [ ] Appellation name on cellar card is clickable, stops event propagation (does not navigate to wine detail), pushes route query filtered by that `appellationId` using existing `filtersToQueryParams`
- [ ] Garde-status badge on cellar card is clickable, stops event propagation, pushes route query with `readyNow` filter set
- [ ] Both remain visually distinct as interactive elements (not just dead text) while keeping the rest of the card as the detail link

## Comments

- Dropped, won't implement.
