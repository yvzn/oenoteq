# Wine Cellar — Consumption History page

Status: ready-for-agent

## Problem Statement

The cellar list shows only Wines still in stock, and a Wine's past Consumptions are visible only on that Wine's detail page. There is no way to look back across the whole cellar at what was drunk and when: "what did I open last month?", "which Bourgognes have I drunk?", "when did I last drink a rosé?" all mean opening Wines one by one, and a Wine whose quantity has reached 0 disappears from the list entirely, so its Consumptions can no longer be reached from the list at all.

## Solution

A new **Consumption History** page, reachable from a third header navigation link ("History" / "Historique"), that looks and behaves like the cellar list but shows one row per Consumption instead of one row per Wine:

- Each row shows the Wine's color rail, producer, color · appellation, millesime, and the Consumption date. A Wine drunk three times appears three times.
- Newest first by default; sortable by producer, appellation, millesime or date, with the same column headers (desktop) and sort panel (mobile) as the cellar list.
- Filterable by appellation, color and meal, with the same filter bar as the cellar list (without the cellar list's "ready now" toggle, which has no meaning for past Consumptions).
- Clicking a row opens the existing Wine detail page, including for Wines whose quantity is now 0. Browser back returns to the same filters, sort and page.
- The page is online-only: it always asks the server. When offline it shows the usual "can't reach the server" status line with a retry. A Consumption recorded in Offline Mode appears in the history only once it has synced.

All text in English and French.

## User Stories

1. As a user, I want a History link in the header next to Cellar and Manage, so that I can reach my Consumption History from anywhere.
2. As a user, I want the History page to list every Consumption I have recorded, across all Wines, so that I can look back at what I drank.
3. As a user, I want one row per Consumption, so that a Wine I drank three times shows three times, each with its own date.
4. As a user, I want each row to show producer, color, appellation, millesime and Consumption date, so that I can recognise the bottle and when I opened it.
5. As a user, I want rows to look like the cellar list's rows (color rail, producer as title, color · appellation underneath), so that the page feels familiar.
6. As a user, I want the newest Consumption first by default, so that what I drank recently is at the top.
7. As a user, I want two Consumptions on the same date to show the one I recorded last first, so that the order is stable and matches what I remember entering.
8. As a user, I want to sort by producer, appellation, millesime or date by clicking a column header, so that I can browse the history the way I need.
9. As a user, I want clicking the active column header again to reverse the direction, so that sorting works like on the cellar list.
10. As a user, I want rows that tie on the sorted column to fall back to newest date first, so that the order inside a group stays meaningful.
11. As a mobile user, I want a sort panel listing producer, appellation, millesime and date, so that I can sort without column headers.
12. As a user, I want to filter the history by appellation, so that I can see which wines of one appellation I have drunk.
13. As a user, I want to filter the history by color, so that I can see e.g. only the rosés I have drunk.
14. As a user, I want to filter the history by meal, so that I can see the wines I drank that suit a given meal according to their Meal Pairing.
15. As a user, I want to combine appellation, color and meal filters, so that I can narrow the history down.
16. As a mobile user, I want the same filter panel as on the cellar list, with a filter count and apply/clear buttons, so that filtering works the same everywhere.
17. As a user, I want a "clear filters" action whenever a filter is active, so that I can get back to the full history in one tap.
18. As a user, I want the history paged with the same page size and pagination controls as the cellar list, so that long histories stay readable.
19. As a user, I want clicking a row to open that Wine's existing detail page, so that I can see its full Consumption history, rating and notes.
20. As a user, I want a row for a Wine I have finished (quantity 0) to still open its detail page, so that finished Wines stay reachable.
21. As a user, I want browser back from the detail page to return to the history with the same filters, sort and page, so that I don't lose my place.
22. As a user, I want filters, sort and page reflected in the URL, so that a reload or a shared link shows the same view.
23. As a user with no Consumption recorded yet, I want a clear "No consumption recorded yet" message, so that I know the page works and is just empty.
24. As a user whose filters match nothing, I want a "No consumption matches these filters" message with a way to clear them, so that I know why the list is empty.
25. As a user who is offline, I want the page to tell me it can't reach the server and offer a retry, so that I understand why nothing shows.
26. As a user in Offline Mode, I want a Consumption I recorded offline to appear in the history once it has synced, so that the history ends up complete.
27. As a user without Cookie Consent, I want the History page to work the same while online, so that refusing device storage doesn't cost me the feature.
28. As a French-speaking user, I want the page, its link, column headers, empty states and messages in French, so that the app stays fully localised.
29. As a user, I want Consumption dates shown in the same locale format as on the Wine detail page, so that dates read consistently.
30. As a user, I want a Wine's later edits (producer, appellation, millesime, color) reflected in its past Consumptions' rows, so that the history always describes the Wine as it is now recorded.
31. As a user, I want the meal filter to follow the current Meal Pairings, so that editing a pairing updates which past Consumptions match.
32. As a cellar list user, I want the cellar list's filters, "ready now" toggle and sort to keep working exactly as before, so that the shared filter bar doesn't change the list.

## Implementation Decisions

- **No new ADR.** The page is easy to remove and involves no surprising trade-off. It deliberately stays online-only (not following ADR 0009's local-store reading) because the local store does not hold every Consumption: Consumptions are stored only inside each Wine's detail copy, filled when that Wine's detail is pulled. Reading history locally would need a bulk Consumption pull, mirrored client-side sort/filter logic with parity tests, and a second adapter implementation — out of scope.
- **New API endpoint: list Consumptions.** `GET /consumptions`, returning every Consumption joined with its Wine's display fields: consumption id, wine id, date, producer (id + name), appellation id, color, millesime. Rating and notes are not needed by the page and are left out. Unlike `/search`, it does **not** exclude Wines with quantity 0.
  - Query parameters use the same names and meaning as `/search`: `meal_id`, `appellation_id`, `color`, `sort_by`, `sort_dir`. The meal filter reuses `/search`'s Meal Pairing semantics: a Consumption matches when its Wine's (Appellation, Color) is currently paired with that Meal.
  - `sort_by` accepts `producer | appellation | millesime | date`; default `date`, `desc`. Invalid values are rejected the same way `/search` rejects them.
  - Tie-breaking: on equal date, higher consumption id first; on ties of any other sort column, date descending then consumption id descending. Text ordering follows the same rules as `/search` (plain binary string comparison).
  - Not paginated: the full filtered, sorted list is returned; the client slices it into pages.
  - The matching request is added to `api.http`.
- **Data gateway:** a new read operation on the data gateway returning the full filtered, sorted Consumption History. Both adapters (direct and local-first) call the server endpoint. The local-first adapter does not read or write the local store for it. The operation rejects with the underlying error when the server can't be reached; the page turns it into the usual status line with retry.
- **Filter and sort types:** the filter shape shared by both pages (meal, appellation, color) becomes a common filters type; the cellar list's search filters are the common filters plus "ready now". A Consumption History sort type mirrors the Wine sort (axis + direction, URL query mapping, next-sort-on-header-click, sort axes list) with axes producer, appellation, millesime, date and default date descending. Query-param mapping omits defaults, as the Wine sort does.
- **Filter bar becomes slot-based:**
  - The filter fields component renders only the common filters (meal, appellation, color) plus a scoped slot for page-specific extra filters. The slot scope exposes the filters currently being edited, an update function, and the testid suffix, so the same slot content works both in the desktop inline form (live filters) and in the mobile panel (draft filters).
  - The filter bar becomes generic over the filters type. It forwards the extra-filters slot into both of its filter fields instances. Active filter count is derived generically (fields that are not null/false). The empty filters value, the sort axes, the axis labels and the default sort become props instead of being hard-wired to the cellar list.
  - The cellar list passes its "ready now" toggle through the slot, extracted into its own small component. Existing test ids (`ready-now-filter`, `ready-now-filter-mobile`, etc.) stay unchanged.
- **History view:** a new route `/history` named for the page, with a header nav link after Cellar. The layout copies the cellar list's: header row with sortable column buttons (producer, appellation, millesime, date) replacing the quantity and status columns, rows as links to the Wine detail route, mobile row showing millesime · date under the name. Filters, sort and page live in the URL query, parsed and written the same way as on the cellar list. Pagination reuses the cellar list's client-side slicing and page size.
- **States:** loading, server unreachable (status line + retry), empty with no filters ("No consumption recorded yet"), empty with filters ("No consumption matches these filters" + clear filters).
- **Glossary:** `CONTEXT.md` already defines **Consumption History** and notes that a Consumption records no Meal; UI text uses "consumption", never "tasting".

## Testing Decisions

- Good tests here check external behaviour only: HTTP responses for the endpoint, and what the user sees and can click for the page. They don't assert on the gateway's internal calls or component internals.
- **Endpoint (Go handler tests via the test harness):** returns every Consumption including those of quantity-0 Wines; default order is date desc with the id tie-break; each sort axis in both directions with its fallback; appellation, color and meal filters alone and combined; meal filter follows current pairings; invalid sort values rejected; empty database returns an empty list. Prior art: the search and consumption handler tests.
- **History page (Vitest view tests with the API client mocked):** this is the main seam and covers the gateway too. Rows render the right fields and link to the Wine detail; header clicks and mobile sort panel change the sort and URL; filters change the request and URL; pagination slices; empty, filtered-empty and server-unreachable states; retry. Run under both consent modes (`itOnlineOnly` / `itOfflineOnly`) to prove both adapters hit the server and the local store isn't used. Prior art: the cellar list view tests.
- **Gateway contract:** add the new operation to the shared contract tests both adapters already run, asserting it returns the server's result and rejects when the server is unreachable. Prior art: the existing gateway contract.
- **Filter bar refactor:** the existing filter bar and cellar list tests must pass unchanged (they are the regression net for "ready now" and sort). Add filter bar tests for a page with no extra slot content: no "ready now" toggle, sort axes from props, active count and clear working.

## Out of Scope

- Offline support for the history page (reading from the local store, bulk Consumption pull, local sort/filter parity).
- Showing rating or notes in the history rows.
- Editing or deleting a Consumption from the history page (still done on the Wine detail page).
- Recording which Meal was actually eaten with a Consumption.
- A "ready now" filter, quantity column or Garde Status column on the history page.
- Server-side pagination.
- Changing the Wine detail page (no "back to history" link; browser back is enough).

## Further Notes

- History grows by a few hundred Consumptions a year at most, so returning the full list and slicing client-side matches the cellar list's approach (ADR 0009) and stays fast for years. Revisit with server-side pagination only if it gets slow.
- Suggested ticket order: (1) slot-based filter bar refactor, no behaviour change; (2) `GET /consumptions` endpoint + `api.http`; (3) gateway operation + History view + nav + i18n, blocked by 1 and 2. Tickets 1 and 2 are independent.
