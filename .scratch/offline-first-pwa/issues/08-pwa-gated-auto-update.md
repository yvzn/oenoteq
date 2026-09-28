# 08: PWA gated silent auto-update

**What to build:** new app versions apply automatically and silently on next open, but never mid-sync — an update is held back until the local outbox is fully empty.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] Service worker registered with `autoUpdate`-style behavior: a new version detected on app open applies without any user-facing prompt
- [ ] If the outbox has pending or failed items when a new version is detected, the update is deferred (not applied) until the outbox drains to empty
- [ ] Once the outbox is empty, a deferred update applies on the next natural app open (no forced mid-session reload while the user is actively using the app)
- [ ] Verified manually: simulate a pending outbox item, trigger a service-worker update, confirm the reload is held back until the item clears
