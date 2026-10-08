# 03: Cellar list and wine detail

**What to build:** the read side of the cellar in English and French: the cellar list with its filters and sorting, and the wine detail with consumption history, quantity adjustment and suggested meals. Wine vocabulary uses the approved labels (Vintage/Millésime, Drinking window/Fenêtre de garde), consumption dates show in the active language, and years always show as plain digits.

**Blocked by:** 02 (Shell, sync surfaces and error messages)

**Status:** ready-for-agent

- [ ] Cellar list: title with plural ("1 wine in cellar" / "2 wines in cellar", "1 vin en cave" / "2 vins en cave"), filter bar and fields, sort headers, loading, error-with-retry and empty states, card text, quantity
- [ ] Wine detail: all labels, Garde window and bounds, suggested meals, quantity adjustment, consumption form and history, empty and error states, confirm texts
- [ ] Consumption dates display localized (`12 March 2026` / `12 mars 2026`) while the stored and submitted value stays `YYYY-MM-DD`
- [ ] Millesime and garde years render as plain digits in both languages
- [ ] User data (producer, appellation and meal names, consumption notes) is shown exactly as stored and unchanged by a language switch
- [ ] Switching language updates mounted list and detail in place with no reload
- [ ] Existing English tests pass unchanged; French smoke tests for the list (plural count, a Garde Status label, a Color label, a sort header) and the detail (a localized date, quantity text)
- [ ] No API, schema or `api.http` change
