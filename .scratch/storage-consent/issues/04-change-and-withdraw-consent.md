# 04: Changing and withdrawing consent

**What to build:** the user can change their Storage Consent at any time from the Manage hub and the header, as easily as they gave it. Withdrawing tries to sync first and never silently drops unsent changes: if any remain (or the app is offline), the user sees how many and must confirm discarding them. Existing installs, which already hold a populated local store and service worker but have no consent record, are gated and left untouched until they choose. See ADR 0010 and `.scratch/storage-consent/spec.md`.

**Blocked by:** 03 (Consent page, route gate and granting)

**Status:** ready-for-agent

- [ ] A change-of-choice screen reachable from the Manage hub and from the header shows the current choice with the same explanations as the consent page and a button to switch it
- [ ] Granting later records the choice and runs Offline Mode's first pull as in ticket 03
- [ ] Withdrawing syncs first when online; an empty outbox proceeds directly; any pending or failed items, or being offline, show the count and require an explicit confirmation to discard; cancelling changes nothing
- [ ] Confirming withdrawal closes and deletes the local store, unregisters the service worker and deletes its caches, records the refusal, then reloads into online-only mode; unsent changes are never dropped without that confirmation
- [ ] The discard-everything step is a standalone primitive that the sync page's "Clear queue" action (`.scratch/real-world-feedback/issues/06`) reuses; whichever ticket lands first creates it
- [ ] An existing install (populated store, no record) is treated as "no choice yet": the guard shows the consent page and the store is neither read nor written until the user answers; granting keeps every record and queued item; refusing runs the withdrawal flow; a service worker registered earlier is unregistered after a refusal
- [ ] A consent-text version bump on an existing record asks again, leaving data untouched until answered
- [ ] A consent change in one open tab makes other tabs reload into the new mode so none writes to a deleted store
- [ ] Tests: each withdrawal path (empty queue, pending items, failed items, offline, cancel, confirm), existing-install gate and refusal, version bump, two-tab behavior, with browser storage and service worker APIs faked at the boundary
- [ ] All text uses translation keys in English and French
- [ ] No API, schema or `api.http` change
