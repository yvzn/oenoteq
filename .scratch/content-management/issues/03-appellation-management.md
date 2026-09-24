# 03: Appellation management page

**What to build:** A cellar owner can see every Appellation, create a new one, rename an existing one to fix a typo/misclick, or delete one that's no longer useful — with a confirmation step before delete, and a clear error if the Appellation is still used by a Wine or a Meal Pairing. Reachable by direct route (nav wiring comes in ticket 05).

**Blocked by:** 01 (ConfirmDialog)

**Status:** ready-for-agent

- [ ] `PUT /appellations/{id}` renames an Appellation; rejects on duplicate name (same as create) and on unknown id (404)
- [ ] `DELETE /appellations/{id}` deletes an Appellation; rejects on unknown id (404)
- [ ] Deleting an Appellation referenced by a Wine is blocked with a distinct "in use" error
- [ ] Deleting an Appellation referenced by a Meal Pairing is blocked with a distinct "in use" error (checked independently of the Wine check — both references block)
- [ ] Frontend Appellation list page: lists all Appellations, links to create, per-row rename and delete
- [ ] Create and rename share one form component (mirroring the Wine form's create/edit pattern), reusing existing shared form components (`FormField`, `AppButton`, `StatusLine`, `useSuccessMessage`)
- [ ] Delete goes through the `ConfirmDialog` from ticket 01
- [ ] A blocked ("in use") delete surfaces its error message inline to the user, not just in the network response
- [ ] Backend tests (via the existing `test.Harness` HTTP seam): successful rename, duplicate-name-rejected rename, successful delete, blocked-delete-when-referenced-by-Wine, blocked-delete-when-referenced-by-Meal-Pairing, rename/delete of unknown id
- [ ] Frontend tests (mounted component, mocked `apiClient`, memory router): list rendering, rename flow, delete-with-confirm flow, blocked-delete error shown
