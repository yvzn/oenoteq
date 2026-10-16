# 04: Sync status pill

**What to build:** while Offline Mode is on, the header shows a pill with a word and a count telling the user where their Changes to Sync stand, replacing the current sync link. States, most important first: "Sync failed · Retry" ("Sync failed" when offline), "Offline · N changes saved", "Syncing…", "N changes to sync", and a quiet "Synced". Clicking opens the Changes to Sync page; from "Sync failed · Retry" and "N changes to sync" it also starts a sync. On desktop the pill sits at the top right of the header; on mobile it moves to the right end of the tabs row. The pending page is titled "Changes to sync" / "Modifications à synchroniser". Without Cookie Consent there is no pill (ADR 0010). See `.scratch/utilities-ux/spec.md`.

**Blocked by:** None (can start immediately). First of the header chain: 04 → 05 → 07.

**Status:** ready-for-agent

- [ ] Five states with the priority failed > offline > syncing > pending > synced
- [ ] Count covers queued and failed changes; failed state shows no number; correct plurals in EN and FR
- [ ] Click navigates to the Changes to Sync page; failed-while-online and pending also start one sync (no double run)
- [ ] Rendered once; placement between header row (≥ 640px) and tabs row (< 640px) by CSS only
- [ ] Hidden entirely without Cookie Consent
- [ ] Sync failures never raise a toast
- [ ] Page title "Changes to sync" / "Modifications à synchroniser"; route unchanged
- [ ] Tests (existing header seam): each state, priority when several apply, click behaviour per state, hidden without consent; sync status view shows the new title
- [ ] Placement checked by hand at ~375px and ~1280px
