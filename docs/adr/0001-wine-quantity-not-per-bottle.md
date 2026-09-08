---
status: accepted
---

# Track Wine as a reference + quantity, not individual bottle instances

Each physical bottle could have been its own record (own id, own location, own consumption date), letting bottles of the same wine diverge over time. Instead, a **Wine** (millesime + appellation + producer + color + garde) holds a single `quantity` count, and drinking one decrements it via a **Consumption** event (date, optional rating/notes) — a stock-ledger model, not per-unit identity. Chosen because the cellar has no per-bottle differentiation to track (no storage location in v1, no per-bottle condition/provenance): a Wine record with a count is simpler to enter and query, at the cost of not being able to say *which* physical bottle was drunk or give bottles from the same case independent histories. Revisit if per-bottle storage location or provenance tracking is ever added.
