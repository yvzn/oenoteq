# Wine Cellar — Offline cellar list and pagination

Status: ready-for-agent

## Problem Statement

The cellar list is the screen the owner opens most, often with no signal (at the table, in the cellar, at a shop). It loads by asking the server to search, so with no connection it fails, even though the app already keeps a full copy of the cellar on the device. When it does work, it also disagrees with the rest of the app: a bottle consumed or a wine added while offline shows up on the detail page but not in the list. The list has no pagination either: with up to about 100 wines in stock, scrolling a long list on a phone is slow and tiring. And the list only refreshes when the app starts or reconnects, so after editing on another device the phone shows stale data until it is relaunched.

## Solution

The cellar list always works, online or offline, because it reads from the copy of the cellar kept on the device (Offline Mode, ADR 0009) with the same filtering, sorting and Garde Status as the server's search. Changes made offline appear in the list immediately. The list refreshes itself in the background when it is opened, when the app returns to the foreground, on reconnect, at app start and when the user asks to retry sync, updating in place without a spinner or losing the user's place. The meal filter works offline because every Meal Pairing is kept on the device too. The list shows 10 wines per page with Previous/Next controls and "Page N of M", the page is kept in the address, and the title keeps the total count. A user who has not allowed storage (ADR 0010) still gets the same pages, served from the server's search. On a first launch with no network and nothing downloaded yet, the list explains that the cellar needs one connected visit instead of looking empty.

## User Stories

### Always available

1. As a cellar owner, I want the cellar list to open with no network, so that I can decide what to drink at the table without a signal.
2. As a cellar owner, I want filters (meal, appellation, color, ready now) to work offline, so that I can still narrow down what suits tonight's dinner.
3. As a cellar owner, I want sorting by producer, appellation, vintage and Garde Status to work offline, so that the list is as useful as online.
4. As a cellar owner, I want the Garde Status shown on each wine to be the same offline as online, so that I'm never misled about what is ready.
5. As a cellar owner, I want only wines I still have (quantity above zero) listed, so that the list stays about my cellar as it is.
6. As a cellar owner, I want a wine I added offline to appear in the list right away, so that the list reflects what I just did.
7. As a cellar owner, I want a wine whose last bottle I just consumed offline to leave the list right away, so that the list and the detail page never disagree.
8. As a cellar owner, I want a bottle count I adjusted offline to show in the list at once, so that quantities are always current.
9. As a cellar owner, I want a wine I edited (for example its drinking window) to show the edit in the list at once, so that my change is never hidden by older data.
10. As a cellar owner, I want the meal filter to work offline for every appellation and color, including ones I never opened before, so that results are complete and not silently partial.
11. As a cellar owner, I want the same wine to appear in the same position online and offline for a given filter and sort, so that the list doesn't reshuffle when the connection changes.

### Staying up to date

12. As a cellar owner, I want the list to refresh from the server when I open it, so that I see what changed on another device.
13. As a cellar owner, I want the list to refresh when I bring the app back to the foreground, so that a phone resumed after hours isn't stale.
14. As a cellar owner, I want the list to refresh when my connection returns and when the app starts, so that it catches up without my doing anything.
15. As a cellar owner, I want refreshing to happen quietly in the background, so that I'm never staring at a spinner for data I can already see.
16. As a cellar owner, I want the list to update in place when new data arrives, keeping my page and scroll position, so that refreshing never loses my place.
17. As a cellar owner, I want rapid repeated opens or foreground returns not to hammer the server, so that the app stays light and quick (at most one background refresh a minute from those two triggers).
18. As a cellar owner, I want my unsent changes sent before the list is refreshed, so that a refresh can't undo something I just did.
19. As a cellar owner, I want a refresh never to overwrite a wine that still has an unsent change, so that my edit is not reverted by older server data.
20. As a cellar owner, I want the sync page's "Retry sync" to refresh the list too, so that one action brings everything up to date.
21. As a cellar owner, I want a failed background refresh to leave the list as it was without an error banner, so that a flaky connection doesn't disturb me.

### Pagination

22. As a cellar owner, I want the list in pages of 10 wines, so that I scroll briefly on my phone.
23. As a cellar owner, I want Previous and Next controls with "Page N of M" at the bottom of the list, so that I can move around the cellar easily.
24. As a cellar owner, I want the page number in the address, so that going back from a wine's detail returns me to the same page.
25. As a cellar owner, I want changing a filter or the sort to return me to page 1, so that I always see the start of the new results.
26. As a cellar owner, I want a new page to start at the top, so that I begin reading from the first wine.
27. As a cellar owner, I want a page that no longer exists (because wines were consumed or filtered out) to show the last available page, so that I never land on an empty page.
28. As a cellar owner, I want Previous disabled on the first page and Next disabled on the last, so that the controls never do nothing silently.
29. As a cellar owner, I want pagination controls hidden when everything fits on one page, so that short lists stay clean.
30. As a cellar owner, I want the title to show the total number of matching wines, not just the page's count, so that I know how big the result is.
31. As a cellar owner, I want sorting to apply to the whole result before paging, so that page 2 continues exactly where page 1 ends.
32. As a user who refused storage, I want the same pages of 10, so that the experience is the same without Offline Mode.

### First launch and empty states

33. As a cellar owner opening the installed app offline for the first time before anything has been downloaded, I want a message saying the cellar needs one connected visit, with a link to the sync page, so that I don't mistake an empty store for an empty cellar.
34. As a cellar owner with a truly empty cellar, I want the usual empty-state message, so that the two cases are not confused.
35. As a cellar owner whose filters match nothing, I want the existing "no wines match" message, so that nothing changes there.

### Consistency with the server

36. As a cellar owner, I want sorting by Garde Status to order wines within the same status by drinking-window start year, following the sort direction and without any extra column, so that nearly-ready wines sort sensibly.
37. As a cellar owner, I want wines with no start year to come last within their status in both directions, so that unset values never lead a group.
38. As a cellar owner, I want vintage sorting to keep non-vintage wines last in both directions, so that they never interrupt the dated wines.
39. As the developer, I want the offline list and the server's search proven to return the same order for the same fixtures, so that online and offline never silently diverge.
40. As the developer, I want a new Meal Pairing read that returns every pairing in one call, so that offline filtering by meal has complete data.
41. As the developer, I want the cellar list written against the data gateway, so that it works in both Offline Mode and online-only mode.
42. As the developer, I want all new text to use translation keys, so that English and French stay complete.

## Implementation Decisions

- **Decision records.** ADR 0009 (cellar list reads the local store) as amended by ADR 0010 (only in Offline Mode; online-only mode uses the server search). ADR 0006 for the outbox and sync. This effort introduces no new ADR.
- **Data source.** In Offline Mode the list reads every Wine from the local store, joins appellation and producer names from the local reference data, computes Garde Status at read time, then filters, sorts and paginates in memory. The local store already holds every Wine (including quantity zero), Producers, Appellations and Meals. The server's search endpoint is unchanged and remains the API; in online-only mode the data gateway's direct adapter calls it and the same pagination applies to its result.
- **Written against the data gateway.** The list asks the gateway for the cellar and never reads the local store or the server directly; this is what lets both consent modes work. If the gateway (storage-consent effort) has not landed yet, introduce the list read as the gateway's first operation, behind the same shape.
- **Filtering.** Quantity above zero; appellation; color; meal (a Wine matches when its (appellation, color) is paired with that Meal); "ready now" matches only Garde Status `ready` (`unassessed` never qualifies). All combine with AND, exactly as the server.
- **Sorting.** Columns: producer, appellation, vintage (Millesime), Garde Status; default appellation ascending; direction ascending or descending. Text ordering is plain binary string comparison, matching the server's database ordering (also the rule for reference lists). Tie-breaks: producer name ascending then id ascending. Vintage: non-vintage wines (no Millesime) always last in both directions. Garde Status order follows the glossary sequence (too young, ready, past peak, unassessed); within the same status, wines are ordered by drinking-window start year (`garde_debut`) in the same direction as the status sort, wines without a start year last in both directions, then the usual tie-breaks. The secondary key is silent: no new column or indicator. The same rule is added to the server's search (real-world-feedback ticket 04) and both must agree.
- **Wines created or changed offline.** Wines with local (negative) ids are listed like any other. A Wine's displayed values come from the local copy, which reflects queued edits, quantity adjustments and consumptions immediately.
- **Meal Pairings for the meal filter.** A new bulk read endpoint on the server returns every pairing edge (appellation, color, meal) in one response, with `api.http` updated (and server tests). The existing per-combination endpoint is unchanged. The full sync pulls the bulk read into the local pairings table, replacing server-known edges while keeping edges that still have an unsent add or remove in the outbox.
- **Pull must not clobber unsent changes.** Any pull (the list's background refresh, reconnect, full sync) must not overwrite a Wine, or a pairing edge, that still has a pending outbox item; once the item syncs, the next pull converges on server state. This is real-world-feedback ticket 01 (stale view after saving) and is a prerequisite.
- **Refresh triggers.** One background refresh routine (push the outbox first, then pull) runs: when the cellar list opens, when the app returns to the foreground, on reconnect, at app start, and from the sync page's "Retry sync" action. The first two are throttled to one run per minute; the last three always run. No pull starts while a push is in flight. The list renders from the local store immediately, then updates in place when the pull completes, keeping page and scroll position. No spinner, toast or message for a successful or failed background refresh. The list reacts to changes in the local store so any write (local or pulled) updates it without navigation.
- **Never-downloaded marker.** The local store records when the first full pull has completed. If it has not completed and the network is unavailable (or the first pull has failed), the list shows the "needs one connected visit" message with a link to the sync page instead of the empty state. An empty store after a successful first pull is a genuinely empty cellar.
- **Pagination.** 10 wines per page, a client-side slice of the full sorted result. Previous/Next controls with "Page N of M" below the list only; hidden when one page suffices; Previous disabled on page 1 and Next on the last page. The page number lives in the address (`page` query parameter) next to the existing filter and sort parameters. Changing any filter or the sort resets to page 1; changing page scrolls to the top; a page number beyond the last clamps to the last page (and a missing or invalid number means page 1). The title shows the total match count. There is no server `limit`/`offset` and no API change for the search.
- **Online-only mode.** The direct adapter returns the server's search result (which already carries Garde Status); the same slicing, controls and clamping apply. The meal filter uses the server. None of the offline refresh machinery runs.
- **Text.** All new text (page controls, the first-launch message, plurals in the title) uses translation keys in English and French (ADR 0011, `docs/i18n-vocabulary.md`).

## Testing Decisions

- **What a good test is here.** Mount the real cellar list at the highest seam and assert what the user sees and what requests were or were not made: which wines appear in which order on which page, which controls are enabled, which message is shown, whether the search endpoint was called. Never assert on how filtering or paging is implemented.
- **Highest seam (existing, reused).** The cellar list's mounted-view tests: memory router, mocked API client, fake IndexedDB seeded with wines, reference data and pairings. In Offline Mode the tests assert the search endpoint is not called and that results come from the local store.
- **One new seam: shared search fixtures.** One set of fixture wines with expected orderings and filter results for a table of (filters, sort, direction) cases, consumed by both the Go search tests and the TypeScript list tests, so the two implementations are proven to agree. It covers: every filter and their combinations, each sort column both ways, ties, vintage-less wines last, the Garde Status secondary key including wines without a start year, quantity zero excluded, and `unassessed` never matching "ready now".
- **Behavior tests (mounted list).** Offline-created wine appears; consumed-to-zero wine disappears; a queued edit shows in the list; a pending wine is not overwritten by a stale pull while the server value wins after it syncs; the meal filter works offline for a never-opened (appellation, color); refresh triggers (open, foreground, reconnect, start, retry) with the one-minute throttle on the first two, push-before-pull ordering and no overlapping pull; a failed background refresh changes nothing visible; in-place update keeps page and scroll; the never-downloaded message versus the empty-cellar message.
- **Pagination tests.** 10 per page; Previous/Next and "Page N of M" and their disabled states; controls hidden for one page; page in the address and restored on back; filter or sort change resets to page 1; out-of-range or invalid page clamps; total count in the title; sorted before sliced; a page change scrolls to the top. The same suite also runs in online-only mode with the search mocked.
- **Server tests.** The new bulk pairing read (every edge returned, empty case, consistency with the per-combination read), and the search's Garde Status secondary sort, through the existing handler test harness.
- **Sync tests.** The pull's pairing merge keeping edges with unsent adds/removes, and the pull not overwriting pending wines, in the style of the existing sync tests.
- **Prior art.** The existing cellar list view tests, the search handler tests, the sync and outbox tests (fake IndexedDB reset between tests), the domain tests for Garde Status and sort parameters, and the connectivity tests.

## Out of Scope

- Pagination of the Meal, Appellation, Producer management lists or any list other than the cellar list.
- Server-side pagination (`limit`/`offset`), infinite scroll or a "show more" control.
- Restoring the scroll offset on back navigation (real-world-feedback ticket 07); the page itself is restored by the address.
- Locale-aware or accent-insensitive sorting; ordering stays binary.
- Offline deletes, tombstones or any change to the sync protocol (ADR 0006).
- The data gateway, consent page and online-only mode themselves (storage-consent effort), beyond this list working through the gateway.
- The i18n foundation and extraction (i18n effort), beyond using translation keys for new text.
- Any change to how filters or sorts look.

## Further Notes

- **Prerequisites.** Real-world-feedback ticket 01 (a pull must not overwrite wines with unsent changes) and ticket 04 (Garde Status secondary sort, which this effort mirrors client-side) should land first. The data gateway (storage-consent effort) is the natural base; the i18n foundation should land before any new text is written. Real-world-feedback ticket 07 (scroll restore) should land after pagination.
- **Suggested order.** Bulk pairings endpoint and local pull → local search engine behind the gateway with shared fixtures, list switched to the local store (still unpaginated) → background refresh triggers and the never-downloaded message → pagination.
- **Size assumption.** A cellar tops out around 100 in-stock wines, so filtering, sorting and slicing everything in memory is cheap; revisit if that assumption changes.
- **Related decisions.** ADR 0006 (offline-first sync), ADR 0009 (cellar list reads the local store), ADR 0010 (storage consent and the data gateway), ADR 0011 (i18n).
