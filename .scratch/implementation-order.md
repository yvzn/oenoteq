# Implementation order

Index of the 22 tickets from the real-world-testing feedback, in the order to implement them (one `/implement` per ticket, `/clear` between). Each ticket's own file stays the source of truth for its scope and `Status:`; this file only fixes the order and the dependencies. Update it if tickets are added, merged or re-scoped.

**Short IDs:** `RWF` = `.scratch/real-world-feedback/issues/`, `I18N` = `.scratch/i18n/issues/`, `SC` = `.scratch/storage-consent/issues/`, `OWL` = `.scratch/offline-wine-list/issues/`. Specs: `.scratch/i18n/spec.md`, `.scratch/storage-consent/spec.md`, `.scratch/offline-wine-list/spec.md`. Decisions: ADR 0009 (cellar list reads local store), 0010 (storage consent, data gateway), 0011 (i18n); vocabulary in `docs/i18n-vocabulary.md`.

**Hard blocker** = the ticket file itself lists it under "Blocked by". **Soft** = ordering preference or wiring to do when the second of the pair lands. Order numbers (`#`) are positions in this list.

## Order

| # | Done | ID | File | Hard blockers (by ID, order #) | Soft |
|---|---|---|---|---|---|
| 1 | [x] | RWF-01 | `real-world-feedback/issues/01-garde-reset-stale-view.md` | none | prerequisite of OWL-03 |
| 2 | [x] | RWF-04 | `real-world-feedback/issues/04-status-sort-secondary-garde-debut.md` | none | prerequisite of OWL-03 |
| 3 | [x] | RWF-03 | `real-world-feedback/issues/03-offline-banner-small-screen-padding.md` | none | |
| 4 | [x] | RWF-02 | `real-world-feedback/issues/02-add-meal-input-not-cleared.md` | none | |
| 5 | [x] | RWF-08 | `real-world-feedback/issues/08-alphabetical-referential-lists.md` | none | before SC-01 so the gateway moves already-sorted reads |
| 6 | [x] | I18N-01 | `i18n/issues/01-foundation-switchable-language.md` | none | after it, all new text uses keys |
| 7 | [x] | OWL-01 | `offline-wine-list/issues/01-pagination.md` | none | |
| 8 | [x] | OWL-02 | `offline-wine-list/issues/02-bulk-meal-pairings.md` | none | |
| 9 | [x] | SC-01 | `storage-consent/issues/01-data-gateway-prefactor.md` | none | after RWF-08 and other small composable edits, to avoid conflicts |
| 10 | [x] | RWF-05 | `real-world-feedback/issues/05-sync-page-retry-all.md` | none | wire to OWL-04's refresh routine when the second of the pair lands (#10 or #17) |
| 11 | [x] | RWF-06 | `real-world-feedback/issues/06-sync-page-clear-all.md` | none | creates the discard-everything primitive SC-04 reuses |
| 12 | [x] | RWF-09 | `real-world-feedback/issues/09-sync-page-status-details.md` | none | |
| 13 | [x] | SC-02 | `storage-consent/issues/02-online-only-mode.md` | SC-01 (#9), OWL-01 (#7) | |
| 14 | [x] | SC-03 | `storage-consent/issues/03-consent-page-gate-and-granting.md` | SC-02 (#13), I18N-01 (#6) | |
| 15 | [x] | SC-04 | `storage-consent/issues/04-change-and-withdraw-consent.md` | SC-03 (#14) | reuses RWF-06's primitive (#11) |
| 16 | [x] | OWL-03 | `offline-wine-list/issues/03-cellar-list-reads-local-store.md` | OWL-02 (#8), SC-01 (#9), RWF-01 (#1), RWF-04 (#2) | |
| 17 | [x] | OWL-04 | `offline-wine-list/issues/04-background-refresh-and-first-launch.md` | OWL-03 (#16) | wires RWF-05 (#10) to the refresh routine |
| 18 | [x] | RWF-07 | `real-world-feedback/issues/07-restore-list-scroll.md` | none | after OWL-01 (#7), best after OWL-04 (#17) |
| 19 | [x] | I18N-02 | `i18n/issues/02-shell-sync-surfaces-and-errors.md` | I18N-01 (#6) | last so legacy text is extracted once |
| 20 | [x] | I18N-03 | `i18n/issues/03-cellar-list-and-wine-detail.md` | I18N-02 (#19) | |
| 21 | [x] | I18N-04 | `i18n/issues/04-forms-and-management.md` | I18N-02 (#19) | |
| 22 | [x] | I18N-05 | `i18n/issues/05-audit-and-contract.md` | I18N-03 (#20), I18N-04 (#21) | |

## Phases

- **A (#1-5):** bug fixes and the two prerequisites for the offline list.
- **B (#6-9):** foundations: i18n foundation, pagination, bulk pairings, data gateway.
- **C (#10-12):** sync page features (Offline Mode only).
- **D (#13-15):** storage consent (compliance).
- **E (#16-18):** offline cellar list, refresh, scroll restore.
- **F (#19-22):** i18n extraction of existing text.

Phases D and E are independent of each other; swap them if the offline list is wanted before consent. Everything in A-C has no hard blockers except where listed.

## Parallel option

Only if running agents in parallel: #3 with #4, #7 with #8, #20 with #21. Everything else touches overlapping files.

## TODO next

- consumption list
- sync status page UX
