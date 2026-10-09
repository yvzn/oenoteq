# 01: Playwright harness and offline-create tracer

**What to build:** one command that runs a real-browser test of the offline-first sync layer against the real built app. A user creates a Wine while offline, reconnects, and the Wine reaches the server with its identity intact. Drives the UI and the network toggle only, never the local store, the outbox or the data gateway, so it survives the gateway refactor unchanged. See `.scratch/e2e/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] One documented command runs the suite locally: it builds the web app and the Go exe (embedded SPA), starts the exe on a free port with a temporary database, waits for the health endpoint, runs the test, then stops the exe and removes the database
- [x] Playwright, Chromium only; no CI job, no deploy gate
- [x] Each run starts from an empty database and an empty browser profile
- [x] A Producer and an Appellation are seeded through the API; the Wine itself is created through the UI
- [x] Tracer flow: open the cellar online (service worker installed, reference data loaded) → go offline → offline banner appears → create a Wine through the form → the Wine shows in the list with the "not yet synced" indicator, and the server holds 0 Wines
- [x] Reconnect → banner and pending indicator disappear, and the server holds exactly 1 Wine with the entered fields
- [x] Reload the page → the Wine is still listed (local id remapped to the server id, not orphaned)
- [x] The test verifies that the offline toggle really reaches the app's connectivity logic in Chromium; if it does not, the harness dispatches the offline/online events explicitly, and the ticket notes which was needed
- [x] Server-side assertions use the test runner's own HTTP client, not the browser, so a service-worker cache cannot hide the server's state
- [x] Waits use polling on observable conditions, no fixed sleeps
- [x] The test never reads or writes the local store
- [x] Passes 10 consecutive runs
- [x] Time-box (not triggered): if stabilising exceeds about one day, stop, record why under `## Comments`, set status accordingly, and remove the blocking edge on the data gateway prefactor ticket
- [x] No API, schema or `api.http` change

**Out of scope:**
- Any other flow (deferred in the spec until a real regression escapes the unit tests)
- CI integration
- Cross-browser runs

## Comments

- Command: `cd web && npm run e2e` (documented in README). Passed 10 consecutive runs, ~12s each.
- Offline toggle: `context.setOffline(true/false)` reaches the app's connectivity logic in Chromium (banner appears and disappears); no explicit event dispatch needed.
- Deviation from the tracer-flow AC ("shows in the list with the not-yet-synced indicator"): the cellar list still calls `/search` (ADR 0009, accepted, is not implemented yet), so offline the new Wine is not in the list. Re-tighten the test to assert the list offline when ADR 0009 lands.
- Storage Consent (ADR 0010) is not implemented either, so no consent step exists; add one when it lands.
- Original text: The "not yet synced" badge is asserted on the Wine detail page the form navigates to. The list is asserted after reconnect, and again after reload.
- The exe embeds `internal/static/dist` (tracked placeholder). Global setup swaps the built SPA in for `go build`, then restores the placeholder via `git checkout`; the working tree stays clean.
