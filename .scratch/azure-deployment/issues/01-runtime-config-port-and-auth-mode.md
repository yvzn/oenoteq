# 01: Runtime config: port and auth mode

**What to build:** the server reads `PORT` (default `8080`) and `AUTH_MODE` (`none` default, or `easyauth`). With `easyauth`, the app reads the caller identity from `X-MS-CLIENT-PRINCIPAL-NAME` and rejects requests lacking it; with `none` nothing changes from today.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Server listens on `PORT` when set, `:8080` otherwise
- [ ] `AUTH_MODE=none` leaves behaviour identical to current (dev and Windows exe)
- [ ] `AUTH_MODE=easyauth` returns 401 on API calls without the identity header; static assets and health endpoint are exempt
- [ ] With `easyauth`, `AUTH_ALLOWED_USERS` (comma-separated) is required; an authenticated identity not in the list gets 403. Empty list fails at startup (never silently open to every Microsoft account)
- [ ] Unknown `AUTH_MODE` value fails at startup with a clear error
- [ ] Tests cover both modes; `api.http` updated if any endpoint is added (e.g. `/healthz`)
