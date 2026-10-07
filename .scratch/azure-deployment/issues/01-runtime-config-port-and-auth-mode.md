# 01: Runtime config: port from env

**What to build:** the server reads `PORT` (default `8080`) so the container platform can choose the listen port. Nothing else changes: authentication is done by Azure Easy Auth in front of the app (ticket 04), not by app code.

**Blocked by:** none

**Status:** implemented

- [x] Server listens on `PORT` when set, `:8080` otherwise
- [x] Invalid `PORT` (non-numeric, out of range) fails at startup with a clear error
- [x] Behaviour with no env vars set is identical to today (dev and Windows exe)
- [x] Tests cover default, override and invalid values
