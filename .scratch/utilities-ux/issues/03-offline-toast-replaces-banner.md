# 03: One-time offline toast replaces the banner

**What to build:** the fixed offline banner is gone. Each time the connection drops, one toast joins the queue on both layouts: with Offline Mode on it says changes are saved on the device; without Cookie Consent it says changes can't be saved while offline. Nothing is shown when the connection returns. An offline toast still up when the connection returns stays until dismissed. See `.scratch/utilities-ux/spec.md` and ADR 0010 (amended).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Offline banner removed, along with the space reserved for it
- [ ] One toast per online → offline transition, queued like any confirmation
- [ ] Wording reuses the existing offline messages, picked by Offline Mode on/off
- [ ] No toast on reconnect
- [ ] Tests (connectivity setup from the existing banner test, moved to the toast seam): one toast per drop, none on reconnect, correct wording with and without consent
