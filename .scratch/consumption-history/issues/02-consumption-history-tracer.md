# 02: Consumption History tracer — list, newest first

**What to build:** A "History" / "Historique" header link, after Cellar, opens the new Consumption History page. It lists every Consumption across all Wines, one row per Consumption, newest first, including Consumptions of Wines whose quantity is now 0. Each row looks like a cellar list row (color rail, producer, color · appellation) with millesime and Consumption date in place of quantity and Garde Status, and opens the existing Wine detail page. The page is online-only in both consent modes. No sort or filter controls yet. See `.scratch/consumption-history/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `GET /consumptions` returns every Consumption with consumption id, wine id, date, producer (id + name), appellation id, color, millesime — no rating or notes; Wines with quantity 0 are included
- [x] Order is date descending; on equal date, higher consumption id first
- [x] Matching request added to `api.http`
- [x] New data gateway read operation returns the full Consumption History; both adapters (direct and local-first) call the server and the local-first adapter does not touch the local store; it rejects when the server can't be reached
- [x] Gateway contract tests cover the new operation for both adapters (returns the server's result, rejects when unreachable)
- [x] `/history` route and header nav link after Cellar
- [x] Desktop rows: color rail, producer, color · appellation, millesime, date, with a non-interactive column header row; mobile rows show millesime · date under the name
- [x] Dates use the same locale format as the Wine detail page
- [x] Clicking a row opens the Wine detail page, including for a Wine with quantity 0
- [x] Client-side pagination with the cellar list's page size and controls; page kept in the URL; browser back from detail returns to the same page
- [x] States: loading; server unreachable (status line + retry); empty ("No consumption recorded yet")
- [x] All new text in English and French; UI says "consumption", never "tasting"
- [x] Go handler tests: all Consumptions returned including quantity-0 Wines, default order with id tie-break, empty database → empty list
- [x] View tests run under both consent modes: rows, links, pagination, empty, unreachable + retry
