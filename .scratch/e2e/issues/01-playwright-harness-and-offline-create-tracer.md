# 01: Playwright harness and offline-create tracer

**What to build:** one command that runs a real-browser test of the offline-first sync layer against the real built app. A user creates a Wine while offline, reconnects, and the Wine reaches the server with its identity intact. Drives the UI and the network toggle only, never the local store, the outbox or the data gateway, so it survives the gateway refactor unchanged. See `.scratch/e2e/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One documented command runs the suite locally: it builds the web app and the Go exe (embedded SPA), starts the exe on a free port with a temporary database, waits for the health endpoint, runs the test, then stops the exe and removes the database
- [ ] Playwright, Chromium only; no CI job, no deploy gate
- [ ] Each run starts from an empty database and an empty browser profile
- [ ] A Producer and an Appellation are seeded through the API; the Wine itself is created through the UI
- [ ] Tracer flow: open the cellar online (service worker installed, reference data loaded) → go offline → offline banner appears → create a Wine through the form → the Wine shows in the list with the "not yet synced" indicator, and the server holds 0 Wines
- [ ] Reconnect → banner and pending indicator disappear, and the server holds exactly 1 Wine with the entered fields
- [ ] Reload the page → the Wine is still listed (local id remapped to the server id, not orphaned)
- [ ] The test verifies that the offline toggle really reaches the app's connectivity logic in Chromium; if it does not, the harness dispatches the offline/online events explicitly, and the ticket notes which was needed
- [ ] Server-side assertions use the test runner's own HTTP client, not the browser, so a service-worker cache cannot hide the server's state
- [ ] Waits use polling on observable conditions, no fixed sleeps
- [ ] The test never reads or writes the local store
- [ ] Passes 10 consecutive runs
- [ ] Time-box: if stabilising exceeds about one day, stop, record why under `## Comments`, set status accordingly, and remove the blocking edge on the data gateway prefactor ticket
- [ ] No API, schema or `api.http` change

**Out of scope:**
- Any other flow (deferred in the spec until a real regression escapes the unit tests)
- CI integration
- Cross-browser runs
