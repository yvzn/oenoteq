# 04: Consumption entry edit/delete

**What to build:** A cellar owner can fix a mistake on a recorded Consumption entry (wrong date, rating, or notes) inline in the Wine detail page's consumption history, or delete an entry recorded against the wrong Wine entirely (restoring that Wine's quantity by one). No re-linking a Consumption entry to a different Wine — delete and re-create instead.

**Blocked by:** 01 (ConfirmDialog)

**Status:** ready-for-agent

- [ ] `PUT /consumptions/{id}` updates date/rating/notes; `wine_id` is not editable; validation matches `CreateConsumption` (date required and parseable, rating optional 1-5); rejects on unknown id (404)
- [ ] `DELETE /consumptions/{id}` deletes the entry and increments the referenced Wine's quantity by 1; rejects on unknown id (404)
- [ ] Consumption history rows on the Wine detail page gain Edit and Delete actions per row
- [ ] Edit expands the row into an inline form (date/rating/notes) rather than navigating to a separate page, mirroring the existing "record a consumption" inline form on the same page
- [ ] Delete goes through the `ConfirmDialog` from ticket 01
- [ ] Backend tests (via the existing `test.Harness` HTTP seam): successful edit of each field, edit validation reuses create's rules, successful delete, delete restores Wine quantity, edit/delete of unknown id (404)
- [ ] Frontend tests (mounted component, mocked `apiClient`, memory router): inline edit flow on `WineDetailView`, delete-with-confirm flow, quantity/UI updates after delete
