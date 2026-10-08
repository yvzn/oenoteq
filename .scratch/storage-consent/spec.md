# Wine Cellar — Storage Consent and Offline Mode gating

Status: ready-for-agent

## Problem Statement

The app keeps a full copy of the cellar and a queue of unsent changes in the browser (IndexedDB) and installs a service worker for offline launch, all from the first visit and without asking. EU users testing it have said this needs their consent under GDPR/ePrivacy: if they don't grant it, nothing should be kept on their device and offline features should be off, and they must be able to grant or withdraw consent later as easily as they gave it. Today there is no way to say no: every write goes through the local store first, so the app cannot work at all without it. Existing testers also already have a populated local store, a registered service worker and possibly unsent changes, none of which were ever consented to.

## Solution

On first visit the user lands on a full-size Storage Consent page, in their language, with two equal choices: allow the app to keep the cellar on this device (turns on Offline Mode), or continue without it. Nothing is stored on the device before they choose except the choice itself. Refusing leaves a fully usable, online-only app: reads and writes go straight to the server, the cellar list uses the server's search, and there are no sync features, no service worker and no PWA install. Granting turns on Offline Mode exactly as it works today. The choice can be changed at any time from the Manage hub and the header. Withdrawing consent first tries to sync, never silently drops unsent changes (if any remain, the user sees how many and must confirm discarding them), then deletes the local data and the service worker. Existing installs are treated as "no choice yet": the local store is untouched until the user chooses, and refusing runs the same safe withdrawal. The sign-in session belongs to the hosting platform and is not covered.

## User Stories

### First visit and the consent page

1. As a first-time EU user, I want to be asked for consent before the app stores anything on my device, so that my privacy choice is respected from the start.
2. As a user, I want the consent to be a full-size page rather than a popup or dialog, so that I can read it properly on a small phone screen.
3. As a user, I want the two choices to carry equal visual weight with neither pre-selected, so that I'm not nudged into allowing storage.
4. As a user, I want refusing to be as easy as accepting (one tap each), so that saying no is not a chore.
5. As a user, I want the page to explain in plain language what is stored (a copy of my cellar, a queue of unsent changes, an app cache for offline launch), why, and what I lose if I refuse (offline use, installing the app), so that my consent is informed.
6. As a user, I want to switch the page between English and French before choosing, so that I can decide in a language I understand.
7. As a user, I want the page to say that signing in is handled by the hosting platform and not covered by this choice, so that I'm not misled about what the choice controls.
8. As a user, I want to be sent back to the page I was trying to open after I choose, so that consent doesn't lose my place.
9. As a user, I want no part of the app to be reachable until I choose on my first visit, so that nothing can store data around the gate.
10. As a user, I want the app not to ask again on later visits, so that I'm not nagged.
11. As a user, I want to be asked again when the consent text or what it covers changes, so that my consent stays informed.

### Using the app without consent

12. As a user who refused, I want to browse my cellar with search, filters, sorting and pages as before, so that refusing doesn't remove core features.
13. As a user who refused, I want to add, edit, consume and delete data when I'm online, so that I can still use the app fully.
14. As a user who refused, I want a clear, friendly error with a retry when a change can't be saved because I'm offline, so that I never think a change was saved when it wasn't.
15. As a user who refused, I want the offline banner to say changes can't be saved while offline (not "saved locally"), so that it never tells me something false.
16. As a user who refused, I want no sync page, no sync indicator in the header and no "not yet synced" badges, so that I'm not shown features that don't exist for me.
17. As a user who refused, I want nothing but my choice (and, if I picked one, my language for the session only) kept on my device, so that my refusal is real.
18. As a user who refused, I want the app not to register a service worker or cache anything, so that the browser's storage for this site stays clean.
19. As a user who refused, I want to be told on the consent page that installing the app on the home screen needs offline storage, so that I understand why it isn't offered.
20. As a user who refused, I want the cellar list to still page in tens, so that long lists are as easy to scroll as for everyone else.

### Granting and using Offline Mode

21. As a user who allowed storage, I want the app to work exactly as it does today (local-first, queued changes, offline launch), so that the offline features I tested still work.
22. As a user who just allowed storage, I want my cellar downloaded straight away, so that it is ready if I go offline next.
23. As a user who just allowed storage, I want clear feedback while the first download runs and a retry if it fails, so that I know when offline use is ready.
24. As a user who allowed storage, I want the app to be installable on my home screen, so that it opens like a native app.
25. As a user who allowed storage, I want my language choice remembered on my device, so that I don't pick it each visit.

### Changing or withdrawing consent

26. As a user, I want to change my choice from the Manage hub and from the header at any time, so that withdrawing is as easy as granting.
27. As a user, I want that screen to show my current choice and what each option means, so that I know what I'm changing.
28. As a user who wants to withdraw, I want the app to sync my unsent changes first, so that nothing I entered offline is lost.
29. As a user whose changes can't be synced yet (offline, or some failed), I want to see how many changes remain and be asked to confirm before they are discarded, so that I never lose work silently.
30. As a user withdrawing consent, I want to be able to cancel and keep everything as it was, so that a mistaken tap changes nothing.
31. As a user who confirmed withdrawing, I want my local cellar, queue and offline cache deleted and the service worker removed, so that nothing is left on my device.
32. As a user withdrawing consent, I want the app to keep working online straight afterwards, so that withdrawing doesn't break it.
33. As a user who refused earlier, I want to grant consent later and get Offline Mode with a first download, so that changing my mind is easy.
34. As a user with the app open in two tabs, I want both to follow a consent change, so that one tab never keeps writing to a store I just deleted.

### Existing installs

35. As an existing tester with a populated local store, I want to be asked for consent on my next visit and have my data left alone until I answer, so that nothing is deleted behind my back.
36. As an existing tester who allows storage, I want to keep my data and queue exactly as they were, so that my testing isn't disrupted.
37. As an existing tester who refuses, I want my unsent changes synced first or explicitly confirmed away, so that I never lose queued work silently.
38. As an existing tester, I want a stale service worker from before consent to stop serving the app once I've refused, so that my refusal takes full effect.

### Maintaining it

39. As the developer, I want one place that decides the data path from the consent record, so that no screen can store data without consent by forgetting a check.
40. As the developer, I want both data paths to pass the same contract tests, so that online-only mode never silently diverges from Offline Mode.
41. As the developer, I want the existing view tests to run in both modes, so that online-only mode is covered by what already exists.
42. As the developer, I want a test proving that before a choice nothing is opened, registered or started, so that the gate can't regress.
43. As the developer, I want the consent version to be a single value I bump, so that re-asking is a one-line change.
44. As the developer, I want the revocation primitive reusable by the sync page's "Clear queue" action, so that discarding queued work has one implementation.

## Implementation Decisions

- **Decision record.** ADR 0010 is the source of truth: Storage Consent gates Offline Mode behind a data gateway with two adapters. `CONTEXT.md` terms: Storage Consent, Offline Mode.
- **Consent record.** One record holding the choice (granted or refused), the consent-text version and a timestamp, stored on the device as the only thing kept before a choice (it is the "strictly necessary" record of the choice itself, and the consent page says so). Absent record, unreadable record, or a version older than the current one all mean "no choice yet". The current version is a single constant. Reading it is synchronous at boot. A refusal is also recorded, so the user isn't re-asked.
- **Consent module.** One module owns reading, writing and observing the record and exposes the current state (no-choice, granted, refused); it notifies other open tabs of changes (storage events) so they follow a change.
- **Boot sequence.** The app decides its mode from the consent record before touching any storage. Granted: open the local store, start sync, register the service worker and its update handling, as today. Refused: none of those happen. No choice: none of those happen either, and the local store is neither read nor written until the user chooses. The existing connectivity check (a health request) works in every mode.
- **Route gate.** A router guard redirects every route to the consent page while the state is "no choice", remembering the intended destination, and returns the user there after they choose. The consent page and the language switcher are reachable in that state. The sync page route redirects away when Offline Mode is off.
- **Consent page.** A full page, never a dialog or popup. Two equal-weight, unselected choices: allow storage (Offline Mode) / continue without. Plain-language text covering what is stored, why, what refusing costs (no offline use, no install), that sign-in is the platform's, and how to change the choice later. Includes the reusable language switcher from the i18n effort. All text in English and French through the i18n catalogs.
- **Change-of-choice screen.** A screen reachable from the Manage hub and from the header showing the current choice with the same explanations and a button to switch it.
- **Data gateway (ADR 0010).** A single interface that the composables call for every read and write of Wines, Consumptions, quantity adjustments, Producers, Appellations, Meals, Meal Pairings and the cellar search. Two adapters implement it: the local-first adapter (the current local store plus outbox plus sync, moved behind the interface unchanged in behavior) and a direct adapter calling the server API. The active adapter is chosen at boot from the consent record. No composable or view checks consent itself. This is a prefactor: land the gateway with only the local-first adapter first, with all existing tests passing, before adding the direct adapter.
- **Direct adapter behavior.** Reads and writes call the server; failures surface through the existing friendly-error and retry UI; there is no outbox, no client-generated local ids, no sync and no "not yet synced" state. The server API is unchanged. The cellar list calls the server search and slices the result into pages of 10 client-side (same page behavior as Offline Mode, per ADR 0009 and its amendment in ADR 0010). Detail, form, management and pairing screens load from the server.
- **Offline UI without consent.** The offline banner uses a different message ("changes can't be saved while offline") and does not link to the sync page; the sync page, header sync indicator and per-record "not yet synced" badges are not shown; installing as a home-screen app is not offered.
- **Granting.** Record the choice, switch to the local-first adapter, register the service worker, open the local store and run the first full pull (push first if anything is queued), with visible progress, an error state and a retry. After the choice completes the app reloads so every module starts cleanly in the new mode.
- **Withdrawing.** From the change-of-choice screen: try a sync first when online. If the outbox is empty, proceed. If anything is pending or failed, or the app is offline so the sync can't run, show the count and require an explicit confirmation to discard; cancelling changes nothing. On confirmation: close and delete the local store, unregister the service worker and delete its caches, record the refusal, then reload into online-only mode. Pending changes are never dropped without that confirmation. The discard-everything step is a standalone primitive shared with the sync page's "Clear queue" action (real-world-feedback ticket 06).
- **Existing installs.** An install with a populated store but no consent record is "no choice yet": the guard shows the consent page, the store is untouched until the user answers. Granting keeps everything. Refusing runs the withdrawal flow above. A service worker registered earlier may serve the app shell while the choice is pending; after a refusal it is unregistered. A version bump on a granted record is treated the same way: ask again, leave the store alone until answered.
- **Locale persistence.** The i18n effort's locale preference module gains its persisted branch here: the language choice is stored only while consent is granted, and held in memory for the session otherwise.
- **Scope of consent.** One single choice (not per purpose). It covers the local store and the service worker/app cache. It does not cover the sign-in session, which belongs to the hosting platform.
- **No API changes.** No endpoint, schema or `api.http` change.
- **Multi-tab.** A consent change in one tab causes the others to reload into the new mode so they never write to a deleted store.

## Testing Decisions

- **What a good test is here.** Drive the real app boot and mounted views with the consent record set up front, and assert what a user or the browser can observe: which page is shown, whether the service worker was registered, whether the local store was opened or written, which network requests were made, what text and controls are visible. Never assert on internal module wiring.
- **Highest seam (existing, reused).** Mounted-view tests with a memory router, the mocked API client and fake IndexedDB, as in the existing view and sync tests. The consent record is set in the test environment's storage before mounting.
- **One new seam: the data gateway.** Contract tests written once against the gateway interface and run against both adapters (local-first with fake IndexedDB and a mocked client; direct with a mocked client). Behaviors covered: list/get/create/update for each entity, quantity adjustment, consumption create/update/delete, search with filters and sorts, errors surfacing as friendly errors. Where the adapters legitimately differ (outbox, local ids, pending state), the contract states the difference explicitly instead of hiding it.
- **Existing suites in both modes.** The existing view test suites for the cellar list, wine detail and form, management pages and pairing view run in Offline Mode (as today) and in online-only mode (new), parameterized by the consent record, so online-only is covered by what already exists.
- **Gate tests.** With no consent record: every route lands on the consent page; the destination is restored after choosing; nothing opens the local store, registers a service worker, starts sync or makes data requests before a choice. With a refusal: same quiet boot, no sync routes, banner variant, no install affordance.
- **Flow tests.** Granting: first pull with progress, error and retry, then Offline Mode behavior. Withdrawing: empty outbox proceeds; pending or failed items show the count and need confirmation; cancel changes nothing; confirmation deletes the store and unregisters the service worker (browser APIs faked at the boundary); offline withdrawal requires confirmation; a failed sync never discards silently. Existing install: populated store plus no record gates and leaves data untouched, refusing runs withdrawal. Version bump re-asks without touching data. Two tabs: a record change reloads the other tab.
- **Unit tests.** The consent module (read, write, versioning, unreadable record, change notification); the guard's redirect and return logic.
- **Prior art.** The existing view, sync, outbox and composable tests (fake IndexedDB reset between tests, mocked API client), the PWA update tests, the connectivity tests, and the sync-status view tests.

## Out of Scope

- Final legal sign-off of the consent wording; the agent drafts it in both languages and the owner reviews it.
- Per-purpose or granular consent options; there is one choice.
- Consent for the platform's sign-in session or any analytics (the app has none).
- Server-side logging of consent, accounts or multi-user consent.
- Automatic periodic re-asking; only a consent-text version bump re-asks.
- Moving the app to a different storage technology, or making offline reads work without the local store.
- The offline wine list and pagination work itself (separate spec); this spec requires only that the list work through the gateway in both modes.
- Changes to the server, schema, API or `api.http`.

## Further Notes

- **Dependencies.** The consent page text and the language switcher depend on the i18n foundation (`.scratch/i18n`). The pagination in online-only mode and the offline list are specified in the offline-wine-list effort; until it lands, the direct adapter serves the list as the current list works against the server. The real-world-feedback tickets for the sync page ("Retry sync", "Clear queue", details) assume Offline Mode only.
- **Suggested order.** Gateway prefactor (local-first adapter only, behavior unchanged) → consent record, guard and page → direct adapter and online-only UI → grant and withdraw flows with existing-install handling and multi-tab → locale persistence branch.
- **Agent decision to review.** After a consent change completes, the app reloads rather than hot-swapping adapters; this avoids stale local-store handles and service worker state at the cost of one reload. Revisit if it proves jarring.
- **Related decisions.** ADR 0002 (single exe deployment), ADR 0006 (offline-first sync), ADR 0008 (Easy Auth, sign-in not covered), ADR 0009 (cellar list reads the local store, amended by ADR 0010), ADR 0010 (storage consent and data gateway), ADR 0011 (i18n).
