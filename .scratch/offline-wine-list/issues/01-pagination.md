# 01: Cellar list pagination

**What to build:** the cellar list shows 10 wines per page with Previous/Next controls and "Page N of M", so scrolling on a phone stays short. The page lives in the address, the title keeps the total count, and the behavior is a client-side slice of the full sorted result, so it works with the list exactly as it loads today and later with the local store or the direct adapter unchanged. See `.scratch/offline-wine-list/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The list shows 10 wines per page, taken from the full result after filtering and sorting (page 2 continues exactly where page 1 ends)
- [ ] Previous and Next controls with "Page N of M" appear below the list only; hidden when everything fits on one page; Previous disabled on the first page and Next on the last
- [ ] The page number is in the address as the `page` query parameter next to the existing filter and sort parameters; going back from a wine's detail returns to the same page
- [ ] Changing any filter or the sort resets to page 1; changing page scrolls to the top
- [ ] A page number beyond the last clamps to the last page; a missing or invalid number means page 1
- [ ] The title shows the total number of matching wines, not the page's count
- [ ] No server `limit`/`offset`, no API change, no `api.http` change; the existing "no wines match" and loading and error states are unchanged
- [ ] All new text uses translation keys if the i18n foundation has landed
- [ ] Tests: 10 per page, controls and their disabled and hidden states, page in the address and restored on back, reset on filter/sort change, clamping and invalid values, total in the title, sorted before sliced, scroll to top on page change
- [ ] Written so the slice works for any list result regardless of source (server search today; local store and direct adapter later)
