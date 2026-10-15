# 04: Background refresh and first-launch message

**What to build:** the cellar list stays fresh without the user doing anything, and never mistakes "not downloaded yet" for "empty cellar". A single background refresh (push the outbox, then pull) runs on the right triggers and updates the list in place with no spinner. On the very first launch with no network, the list explains that the cellar needs one connected visit. See ADR 0009 and `.scratch/offline-wine-list/spec.md`.

**Blocked by:** 03 (Cellar list reads the local store)

**Status:** done

- [x] One refresh routine pushes the outbox first, then pulls; no pull starts while a push is in flight and refreshes never overlap
- [x] It runs when the cellar list opens and when the app returns to the foreground (together throttled to one run a minute), and on reconnect and at app start (always)
- [x] The sync page's "Retry sync" (`.scratch/real-world-feedback/issues/05`) uses the same routine; whichever ticket lands second wires it in
- [x] The list renders from the local store immediately, then updates in place when the pull completes, keeping page and scroll position; no spinner, toast or message for a successful or a failed refresh
- [x] A pull never overwrites a wine or pairing edge that has an unsent change; once it syncs, the next pull converges on server state
- [x] The local store records when the first full pull has completed
- [x] If the first pull has not completed and the network is unavailable (or that pull failed), the list shows a message that the cellar needs one connected visit, with a link to the sync page, instead of the empty state; after a successful first pull, an empty store is a genuinely empty cellar with the usual message
- [x] The empty-state for filters that match nothing is unchanged
- [x] Tests: each trigger and the one-minute throttle on open and foreground, push-before-pull ordering, no overlapping pulls, a failed refresh changes nothing visible, in-place update keeps page and scroll, never-downloaded versus empty cellar
- [x] Not shown or run in online-only mode (no local store)
- [x] All new text uses translation keys if the i18n foundation has landed
- [x] No API, schema or `api.http` change
