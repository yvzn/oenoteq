# Wine Cellar — E2E tracer for the offline-first sync layer

Status: ready-for-agent

## Problem Statement

The app is offline-first: writes go to a local store and an outbox, and sync to the server later. Every test of that layer today runs against a fake IndexedDB and a mocked API client, in jsdom. Nothing proves that the real browser, the real IndexedDB, the browser's online/offline events, the embedded SPA and the real server agree with those mocks. A large refactoring is about to rework exactly that layer (the data gateway prefactor, then the direct-to-server adapter behind Storage Consent), followed by i18n. If the mocks diverge from reality, the refactor could pass every test and still break offline creation in the real app.

Real-world feedback does not, by itself, justify a broad E2E suite: of nine tickets, only the scroll-restore one needs a real browser, and the one serious bug (stale view after an edit) is reproducible and testable at composable level. The justification is narrower: the sync layer is the app's core risk and has never been exercised end to end.

## Solution

A single end-to-end "tracer" test, run on demand against the real built app: a user creates a Wine while offline, reconnects, and the Wine reaches the server with its identity intact. It runs in a real Chromium against the real exe (embedded SPA, temporary database). If this one flow cannot be made stable, the E2E approach is judged not worth its cost and is dropped.

The harness is deliberately small and implementation-agnostic: it drives the UI and the network toggle only, so it survives the gateway refactor unchanged. It is a characterization net for the refactor, not a coverage goal.

Further flows are deferred. Each is added only after a real regression slips past the unit tests; the same trigger promotes the suite to CI.

## User Stories

1. As the developer, I want a test that creates a Wine while offline and verifies it reaches the server after reconnecting, so that I can refactor the sync layer without fearing a silent break.
2. As the developer, I want the test to run against the real built exe with the embedded SPA, so that static serving and client-side routing fallback are exercised too.
3. As the developer, I want each run to start from a fresh temporary database and an empty browser profile, so that results never depend on leftover state.
4. As the developer, I want reference data (a Producer and an Appellation) seeded through the API, so that the test spends its steps on the behaviour under test, not on setup through the UI.
5. As the developer, I want the test to assert that the server has no Wine while the browser is offline, so that I know the Wine was only queued, not secretly sent.
6. As the developer, I want the test to assert the offline banner and the "not yet synced" indicator appear while offline, so that the user-visible pending state is covered.
7. As the developer, I want the test to assert, after reconnecting, that the pending indicator disappears and the server holds exactly one Wine with the entered fields, so that "synced" is proven on both sides.
8. As the developer, I want the test to reload the page after sync and still find the Wine in the cellar list, so that a Wine whose local id was remapped to the server id is not orphaned.
9. As the developer, I want the test to wait on observable conditions (polling) rather than fixed sleeps, so that it is not flaky.
10. As the developer, I want the test to drive only the UI and the network toggle, never the local store's internals, so that it keeps passing across the gateway refactor.
11. As the developer, I want one documented command to run the suite locally, so that running it before a release is a habit, not a chore.
12. As the developer, I want the release instructions to say "run the E2E before release", so that the missing CI gate is covered by a written step.
13. As the developer, I want the list of deferred flows and their trigger recorded, so that I know when to add one and when to promote the suite to CI.
14. As the developer, I want a time-box on stabilising the tracer, so that a flaky harness is abandoned rather than endlessly tuned.
15. As the developer, I want the suite to need no changes to the API, schema or `api.http`, so that adding it carries no product risk.

## Implementation Decisions

- **Tool:** Playwright, Chromium only. WebKit and iOS differences are out of scope for now.
- **Target:** the real production build, not the dev server. Global setup builds the web app, builds the Go exe (which embeds it), starts it on a free port with a temporary database file, waits for the health endpoint to answer, and stops it and removes the database afterwards. The exe is configured through its existing `PORT` and `DB_PATH` environment variables; no code change is needed.
- **Data:** the Producer and Appellation the Wine form requires are created through the API before the browser opens. The Wine itself is created through the UI, since that is the behaviour under test.
- **Offline simulation:** the browser context's offline toggle, plus making sure the page receives the offline and online events the app listens to. The tracer must verify that the toggle really triggers the app's connectivity logic; if it does not in Chromium, the harness dispatches the events explicitly. Finding this out is part of the tracer's job.
- **Service worker:** the first online visit gives the service worker time to install and the local store time to load reference data before going offline. If the service worker caches API calls in a way that hides the server state, the server-side assertions use the test runner's own HTTP client, not the browser.
- **Agnosticism:** the test knows the UI (existing test ids and labels) and the HTTP API. It does not know the local store, the outbox or the gateway.
- **Order:** the harness plus this flow come first and block the data gateway prefactor ticket of the Storage Consent effort. Other work does not wait on it.
- **Run mode:** local and on demand only. No CI job, no deploy gate. The release instructions gain one line telling the developer to run the E2E first.
- **Storage Consent interaction:** Storage Consent is not built yet. When its consent page lands, the flow gains a first step that grants consent. That is a one-line change to the test.
- **Deferred flows**, each gated on a real escape from the unit tests: offline consumption then sync; editing a Wine with a pending update (the stale-view race); service worker update prompt; cellar list scroll restore on back navigation; consent refused leaves an online-only working app; language choice persists across reload; golden-path smoke (add, consume, search). i18n and consent tickets may add a flow as they land, case by case, not automatically.
- **Promotion to CI:** the first time a regression slips past local runs, add a CI job. Until then, none.
- **No state management library:** decided against, recorded here because it was assessed in the same discussion. The data gateway is the seam for server and offline state; reconsider only if cross-view UI state appears that composables cannot share cleanly.
- **No ADR:** the decision is cheap to reverse and not surprising. This spec is its record.

## Testing Decisions

- **What makes a good test here:** it asserts only what a user (or the server's HTTP API) can observe: banner, pending indicator, list contents, server contents. It waits on those observables with polling, never fixed sleeps. It never reads or writes the local store.
- **Seam:** one seam, the highest possible: the browser UI over the real HTTP server, black box. No new in-code seams are introduced.
- **What is tested:** only the tracer flow described above.
- **Stability gate:** the tracer must pass repeatedly (for example ten consecutive runs) before it counts as done. If stabilising it exceeds roughly one day, stop and drop the E2E effort; record why.
- **Prior art:** none for E2E. For the logic underneath, the existing composable tests over a fake IndexedDB and the backend handler tests over a test harness. The E2E complements them and does not replace them.
- **Regression tests for the real-world feedback:** the stale-view-after-edit bug and the Meal Pairing input that is not cleared get ordinary composable and view tests under their own tickets, not E2E.

## Out of Scope

- A broad E2E suite, visual or layout checks, and cross-browser runs.
- CI integration and any deploy gate; post-deploy smoke against Azure behind Easy Auth.
- All deferred flows listed above.
- A state management library.
- Any change to the API, schema, `api.http`, or the app's behaviour.
- The gateway prefactor itself and the Storage Consent work (separate efforts; this one only blocks the prefactor).

## Further Notes

- The assessment that led here: the feedback tickets point to missing unit and view tests more than to a need for E2E. The remaining justification is the untested real-browser sync path under a heavy refactor. The tracer is sized to that risk and no more.
- One open question was never answered: whether the developer has met a real-world sync, service worker or PWA failure that mocks would have missed. If so, widen the scope accordingly.
