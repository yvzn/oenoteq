# 05: Offline Consumption recording + manual quantity adjustment

**What to build:** recording a Consumption, editing one, and manually correcting a Wine's quantity all work offline, using the delta-event mechanism from ticket 03 and the outbox foundation from ticket 04.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Recording a Consumption offline (date required, rating/notes optional) queues it in the outbox and immediately decrements the displayed quantity by one, locally
- [ ] Editing a Consumption's rating/notes works offline (LWW field-patch), queued the same way
- [ ] Canceling a Consumption still sitting unsent in the local outbox removes it from the queue entirely — no server call, since nothing was pushed yet
- [ ] A Wine blocked at quantity zero still can't have a new Consumption recorded, offline or online, same as today's behavior
- [ ] Manually adjusting a Wine's quantity (stock correction) works offline, queued as a signed delta, reflected immediately in the local display
- [ ] Both consumption-driven and manual quantity changes sync correctly once back online, and a retried sync of either never double-applies
- [ ] Wine Detail's consumption history and quantity stay consistent with the local store while offline (no stale numbers)
- [ ] Component tests cover: offline consumption recording updates quantity immediately, offline consumption cancel-before-sync, offline manual quantity adjustment
