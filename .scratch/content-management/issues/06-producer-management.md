# 06: Producer management page

**⚠️ External blocker — do not start until this is cleared:** Producer is not a real entity yet (still a free-text column on Wine). A separate spec, `.scratch/producer-management/spec.md` (status `ready-for-agent`, its own effort/directory, not part of this ticket set), turns Producer into a real entity (`producer` table + `producer_id` FK on Wine) but explicitly excludes rename/delete/a management page. **This ticket must not be picked up until that other spec has actually shipped** — there is no numeric in-tracker link to it since it lives outside this issue set; check its status directly before claiming this ticket.

**What to build:** Once Producer is a real entity, a cellar owner can see every Producer, create a new one, rename an existing one to fix a typo/misclick, or delete one that's no longer useful — with a confirmation step before delete, and a clear error if the Producer is still used by a Wine. The Manage hub gets a fourth link to this page.

**Blocked by:** 01 (ConfirmDialog), 05 (Manage hub + nav reorg) — plus the external blocker above

**Status:** ready-for-agent

- [ ] `PUT /producers/{id}` renames a Producer; rejects on duplicate name (same as create) and on unknown id (404)
- [ ] `DELETE /producers/{id}` deletes a Producer; rejects on unknown id (404)
- [ ] Deleting a Producer referenced by a Wine is blocked with a distinct "in use" error
- [ ] Frontend Producer list page: lists all Producers, links to create, per-row rename and delete
- [ ] Create and rename share one form component (mirroring the Wine form's create/edit pattern), reusing existing shared form components (`FormField`, `AppButton`, `StatusLine`, `useSuccessMessage`)
- [ ] Delete goes through the `ConfirmDialog` from ticket 01
- [ ] A blocked ("in use") delete surfaces its error message inline to the user, not just in the network response
- [ ] Manage hub page (ticket 05) gains a fourth link to Producers
- [ ] Backend tests (via the existing `test.Harness` HTTP seam): successful rename, duplicate-name-rejected rename, successful delete, blocked-delete-when-referenced, rename/delete of unknown id
- [ ] Frontend tests (mounted component, mocked `apiClient`, memory router): list rendering, rename flow, delete-with-confirm flow, blocked-delete error shown
