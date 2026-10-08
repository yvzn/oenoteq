# 03: Cellar list reads the local store

**What to build:** in Offline Mode the cellar list always works, online or offline, because it reads from the cellar copy on the device through the data gateway, with the same filtering, sorting and Garde Status as the server's search. Wines added, edited, adjusted or consumed offline show up in the list immediately, and the meal filter works offline for every appellation and color. See ADR 0009 (amended by ADR 0010) and `.scratch/offline-wine-list/spec.md`.

**Blocked by:** 02 (Bulk meal pairings), `.scratch/storage-consent/issues/01` (Data gateway prefactor), `.scratch/real-world-feedback/issues/01` (a pull must not overwrite wines with unsent changes), `.scratch/real-world-feedback/issues/04` (Garde Status secondary sort on the server)

**Status:** ready-for-agent

- [ ] In Offline Mode the list is served by the gateway's local-first adapter from the local store; the search endpoint is never called; online-only mode keeps calling it
- [ ] Filters: quantity above zero; appellation; color; meal (a wine matches when its appellation and color are paired with it); "ready now" matches only Garde Status `ready` and never `unassessed`; all combine with AND
- [ ] Sorting by producer, appellation, vintage and Garde Status, both directions, default appellation ascending; text ordering is plain binary comparison; tie-breaks producer name then id; non-vintage wines last in both directions
- [ ] Garde Status sorts in glossary order (too young, ready, past peak, unassessed); within a status, by drinking-window start year in the status sort's direction, wines without a start year last in both directions; the secondary key is silent (no new column or indicator)
- [ ] Garde Status is computed at read time with the same rules as the server
- [ ] Wines with local (negative) ids are listed; queued edits, quantity adjustments and consumptions are reflected immediately; a wine consumed down to zero leaves the list
- [ ] The list updates when the local store changes, without navigation
- [ ] A shared set of search fixtures (wines, expected results for a table of filters, sorts and directions) is read by both the Go search tests and the TypeScript list tests, proving they agree; it covers every filter and combination, each sort both ways, ties, vintage-less wines, the Garde Status secondary key including wines without a start year, quantity zero excluded, and `unassessed` never matching "ready now"
- [ ] Mounted-list tests: offline-created wine appears, consumed-to-zero wine disappears, a queued edit shows, a pending wine isn't overwritten by a stale pull, the meal filter works for a never-opened appellation/color
- [ ] Pagination from ticket 01 works on this source unchanged
- [ ] No API, schema or `api.http` change in this ticket
