# 03: Wine CRUD

**What to build:** The cellar owner can add a Wine to their cellar (millesime optional, appellation, producer, color, garde range, quantity), edit any of its fields afterward, list all Wines with their quantity, and view a single Wine's full detail. A Wine with quantity 0 stays visible — nothing about this ticket deletes a Wine record. Per ADR-0001, Wine has no per-bottle identity; quantity is a plain count.

**Blocked by:** 02 (Appellation & Meal reference lists)

**Status:** ready-for-agent

- [x] Create a Wine: millesime (nullable int), appellation (must reference an existing Appellation), producer (free text), color (rouge/blanc/rose only), garde_debut/garde_fin (ints), quantity (int ≥ 0)
- [x] Creating a Wine with an unknown appellation id, an invalid color, or a negative quantity is rejected
- [x] Creating a Wine with no millesime succeeds (non-vintage support)
- [x] Edit any field of an existing Wine
- [x] List all Wines, including those with quantity 0, showing quantity
- [x] Get a single Wine's full detail (millesime, appellation, producer, color, garde, quantity)
- [x] Tests drive all of the above through the real-SQLite HTTP seam
