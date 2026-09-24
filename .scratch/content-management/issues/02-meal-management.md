# 02: Meal management page

**What to build:** A cellar owner can see every Meal, create a new one, rename an existing one to fix a typo/misclick, or delete one that's no longer useful — with a confirmation step before delete, and a clear error if the Meal is still used by a Meal Pairing. Reachable by direct route (nav wiring comes in ticket 05).

**Blocked by:** 01 (ConfirmDialog)

**Status:** done

- [x] `PUT /meals/{id}` renames a Meal; rejects on duplicate name (same as create) and on unknown id (404)
- [x] `DELETE /meals/{id}` deletes a Meal; rejects on unknown id (404)
- [x] Deleting a Meal referenced by any Meal Pairing is blocked with a distinct "in use" error, not a silent failure or a cascade
- [x] Frontend Meal list page: lists all Meals, links to create, per-row rename and delete
- [x] Create and rename share one form component (mirroring the Wine form's create/edit pattern), reusing existing shared form components (`FormField`, `AppButton`, `StatusLine`, `useSuccessMessage`)
- [x] Delete goes through the `ConfirmDialog` from ticket 01
- [x] A blocked ("in use") delete surfaces its error message inline to the user, not just in the network response
- [x] Backend tests (via the existing `test.Harness` HTTP seam): successful rename, duplicate-name-rejected rename, successful delete, blocked-delete-when-referenced, rename/delete of unknown id
- [x] Frontend tests (mounted component, mocked `apiClient`, memory router): list rendering, rename flow, delete-with-confirm flow, blocked-delete error shown
