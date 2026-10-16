---
status: accepted
---

# Storage consent gates Offline Mode behind a data gateway with two adapters

EU users must consent before the app keeps data on their device (GDPR/ePrivacy), so IndexedDB and the service worker are enabled only after an explicit Storage Consent; without it the app is fully usable but online-only. Rather than scatter consent checks through every composable, composables call one data gateway interface with two adapters — local-first (Dexie + outbox, ADR 0006) and direct-to-server — chosen at boot from the stored consent and swapped when it changes. This supersedes ADR 0006's "both phone and desktop clients go through this same local-first layer" and amends ADR 0009: the cellar list reads the local store only while Offline Mode is on, otherwise it calls the server `/search` and paginates the result client-side.

## Considered Options

- **`if (consent)` checks per composable** — rejected: every read and write path forks, and one missed check stores data without consent.
- **Locked out until consent** — rejected: refusing storage shouldn't disable the app, only the offline capability.
- **Read-only without consent** — rejected: no reason to block writes when the server is reachable.

## Consequences

- Consent is asked on first visit on its own page, with equal-weight choices (same size, font and colour, side by side, each clearly labelled with its outcome, one tap each, neither pre-selected), and is changeable later from the footer's "Cookie preferences" link. The record (choice, consent-text version, timestamp) is the only thing stored before a choice; it is re-asked only when the version changes.
- Existing installs are treated as "no choice yet": the local store is neither read nor written until the user chooses. Refusing (or revoking later) syncs first; if changes remain pending or failed, the count is shown and the user must confirm discarding them before IndexedDB is deleted and the service worker unregistered. Pending changes are never dropped silently.
- Without consent: no `startSync`, no service worker, no Dexie; the one-time offline toast says changes can't be saved while offline; the sync page and sync status pill are hidden; the app isn't installable as a PWA.
- Both adapters must satisfy the same contract tests.

_Amended 2026-10-16: the concept is named Cookie Consent in the UI and glossary (code identifiers keep "storage"); consent is changed from the footer's "Cookie preferences" link instead of the Manage hub; the offline banner is replaced by a one-time offline toast. See `.scratch/utilities-ux/spec.md`._

_Amended 2026-10-16: equal weight is defined as same size, font and colour, side by side, with clear outcome labels — not an identical style. "Allow offline mode" is filled and "Online only" outlined in the same brand colour, which keeps equal weight. Refusing must never become smaller, greyed out or a plain link. See `.scratch/consent-ux/spec.md`._
