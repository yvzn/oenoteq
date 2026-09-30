# 07: Sync-status UI

**What to build:** the full user-facing sync-status surface — offline banner, header indicator, dedicated sync-status page, and per-entity "not yet synced" badges — tying together the outbox state from tickets 04-06.

**Blocked by:** 04, 05, 06

**Status:** done

- [x] Offline banner, styled like the existing success toast, with no dismiss control: visible purely based on live connectivity state ("No network — changes are saved locally and will sync when you're back online"), disappears the instant connectivity returns
- [x] Clicking the offline banner navigates to a new sync-status page
- [x] A header indicator (icon/badge) also links to the sync-status page, visible whenever there's ≥1 pending or failed outbox item, online or offline; hidden once the outbox is fully empty and clean
- [x] Sync-status page shows one pending-count per entity type: Wine, Consumption, Producer, Appellation, Meal, Meal Pairing
- [x] Sync-status page also lists failed items below the counters, each with a plain-language reason and a suggested next step (e.g. "this producer no longer exists — recreate it, then retry")
- [x] Failed items on the sync-status page can be retried or discarded individually, without affecting other queued items
- [x] A Wine/Producer/Appellation/Meal's own Detail or Edit view shows a small "not yet synced" badge when that specific record still has a queued create/edit in the outbox
- [x] Component tests cover: banner visibility toggling with connectivity, header indicator show/hide logic, sync-status page rendering of counts and failures, retry/discard actions, per-entity badge visibility
