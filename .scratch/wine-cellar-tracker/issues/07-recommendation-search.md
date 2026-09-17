# 07: Recommendation / search endpoint

**What to build:** A search endpoint the cellar owner can query with independent, combinable filters — meal, appellation, color, and "ready to drink now" — ANDed together, to find something to open. Wines with quantity 0 are excluded by default. Every result carries a garde status (too_young / ready / past_peak); wines outside the garde window are flagged, not hidden, unless the "ready now" filter is explicitly set.

**Blocked by:** 03 (Wine CRUD), 04 (Meal Pairing management)

**Status:** done

- [x] Search accepts optional filters: meal, appellation, color, ready_now — each independently optional
- [x] Multiple filters combine with AND semantics (e.g. appellation + ready_now narrows to both)
- [x] Search by ready_now alone (no meal/appellation) returns everything currently in its garde window
- [x] Search by appellation alone (no meal) returns everything owned from that appellation
- [x] Search by meal filters to Wines whose (appellation, color) is paired with that meal, per the Meal Pairing lookup
- [x] Every result includes a garde status: too_young, ready, or past_peak, computed from today's date vs. the Wine's garde range
- [x] Without ready_now set, too_young and past_peak Wines are still included in results (flagged, not excluded)
- [x] With ready_now set, only Wines currently in their garde window are returned
- [x] Wines with quantity 0 are excluded from results by default
- [x] Tests drive all of the above through the real-SQLite HTTP seam, covering each filter alone and in combination
