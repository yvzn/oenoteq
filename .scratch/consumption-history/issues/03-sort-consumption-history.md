# 03: Sort Consumption History

**What to build:** On the Consumption History page the user can sort by producer, appellation, millesime or date: by clicking column headers on desktop (same behaviour as the cellar list: a new column starts ascending, clicking the active column reverses it), or through the filter bar's sort panel on mobile. Default stays date descending. Sort is kept in the URL so reload and browser back keep it. See `.scratch/consumption-history/spec.md`.

**Blocked by:** 01 (Slot-based filter bar), 02 (Consumption History tracer)

**Status:** done

- [x] `GET /consumptions` accepts `sort_by` (`producer | appellation | millesime | date`) and `sort_dir` (`asc | desc`), default `date` / `desc`; invalid values rejected the same way `/search` rejects them
- [x] Ties on date → higher consumption id first; ties on any other column → date descending, then consumption id descending; text ordering matches `/search` (binary string comparison)
- [x] `api.http` request updated with sort parameters
- [x] A Consumption History sort type mirrors the Wine sort (axis + direction, URL query mapping that omits defaults, next sort on header click, sort axes list)
- [x] Desktop column headers for producer, appellation, millesime and date are sort buttons with the active direction indicator
- [x] The filter bar is mounted on the page (with an empty common filters set, no extra slot) so the mobile sort panel lists producer, appellation, millesime and date
- [x] Changing sort resets to page 1 like the cellar list, and is reflected in the URL and the request
- [x] Sort labels in English and French
- [x] Go handler tests: each axis in both directions with its fallback order; invalid sort values rejected
- [x] View tests: header clicks and mobile sort panel change the sort, URL and request
