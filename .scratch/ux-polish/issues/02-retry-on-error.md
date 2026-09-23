# 02: Retry on error

**What to build:** User hitting a load error on any page (cellar list, wine detail, wine form, meal pairings) gets a retry action instead of a dead-end message — clicking it re-runs the same load that failed, no full page reload needed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] StatusLine component supports a retry action (slot or prop) shown only in error tone
- [x] Cellar list error state wires retry to existing search/load
- [x] Wine detail error state wires retry to existing `loadWine`
- [x] Wine form load-error state wires retry to existing load
- [x] Meal pairings load-error state wires retry to existing load

**Note (out of scope for this ticket):** backend error strings (`internal/handlers/handlers.go`, e.g. "invalid request", "invalid wine id") get concatenated raw into these UI messages. Softening that wording is a backend follow-up, not part of this ticket.
