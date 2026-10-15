# 02: Online-only mode (direct adapter)

**What to build:** a fully usable app with no device storage. A consent record module holds the user's choice; at boot the app picks its data path from it. When the record says "refused", the app never opens the local store, registers the service worker or starts sync, and every read and write goes straight to the server through a direct adapter. The cellar list uses the server search and pages of 10. Offline UI that assumed local-first is replaced or hidden. Demoable by setting the record to "refused" (there is no consent page yet). See ADR 0010 and `.scratch/storage-consent/spec.md`.

**Blocked by:** 01 (Data gateway prefactor), `.scratch/offline-wine-list/issues/01` (Cellar list pagination)

**Status:** done

- [ ] A consent module reads, writes and observes one record (choice, consent-text version, timestamp); an absent or unreadable record, or an older version, means "no choice yet"; the current version is a single constant; reading is synchronous at boot; unit-tested
- [ ] Boot decides the mode from the record before touching any storage: granted starts the local store, sync and service worker as today; refused and no-choice do none of those
- [ ] A direct adapter implements the gateway interface against the server API: reads and writes of every entity, quantity adjustment, consumption create/update/delete and the cellar search; failures surface as friendly errors with retry; no outbox, no local ids, no pending state
- [ ] The cellar list in refused mode calls the server search and reuses the pagination built in `.scratch/offline-wine-list/issues/01` (pages of 10, Previous/Next, "Page N of M", page in the address, clamping, reset on filter/sort change, total count in the title); no second pagination implementation
- [ ] The offline banner in refused mode says changes can't be saved while offline and does not link to the sync page
- [ ] In refused mode the sync page route redirects away, the header sync indicator and "not yet synced" badges are not shown, and no PWA install is offered
- [ ] The contract tests from ticket 01 also run against the direct adapter, with the adapter differences stated in the contract
- [ ] The existing view suites (cellar list, detail, forms, management pages, pairing view) run in both modes, parameterized by the consent record
- [ ] A test proves that in refused and no-choice modes nothing opens the local store, registers a service worker, starts sync or sends a data request at boot
- [ ] All new text uses translation keys if the i18n foundation has landed
- [ ] No API, schema or `api.http` change
