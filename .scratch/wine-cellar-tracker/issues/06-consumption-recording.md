# 06: Consumption recording

**What to build:** The cellar owner can record a Consumption against a Wine (date required, rating 1–5 optional, notes optional), which decrements that Wine's quantity by 1, and can view a Wine's full Consumption history. Recording is append-only for v1 — no editing or deleting a past Consumption.

**Blocked by:** 03 (Wine CRUD)

**Status:** ready-for-agent

- [x] Record a Consumption for a Wine: date required, rating optional (1–5), notes optional (free text)
- [x] Recording a Consumption decrements the parent Wine's quantity by 1 in the same operation
- [x] Recording a Consumption when the Wine's quantity is already 0 is rejected (quantity never goes negative)
- [x] Rating outside 1–5 is rejected
- [x] List a Wine's full Consumption history (all past events with date/rating/notes)
- [x] Tests drive all of the above through the real-SQLite HTTP seam, including the zero-quantity rejection case
