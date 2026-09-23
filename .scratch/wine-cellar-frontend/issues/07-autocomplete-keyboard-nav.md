# 07: Autocomplete keyboard navigation & Enter-to-submit

**What to build:** Keyboard-only support for the autocomplete fields (appellation/meal pickers) and the inline "create new X" mini-forms (new meal, new appellation), so a cellar owner never has to reach for the mouse to pick a match or confirm a quick add.

**Blocked by:** 01, 02, 05, 06

**Status:** todo

- [ ] In `AutocompleteField.vue`: `ArrowDown`/`ArrowUp` move a highlighted option (wrapping at the ends); `Enter` selects the highlighted option; `Escape` closes the list and reverts the query text to the current selection
- [ ] The input exposes `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; the list exposes `role="listbox"`; each option exposes `role="option"` and `aria-selected`
- [ ] Decide and document: does `Enter` inside the "add meal" / "create meal" / "create appellation" mini-forms submit that form, and does that conflict with `Enter` being used to accept an autocomplete match when the list is open? (The reverted code wired both without resolving this — e.g. does `Enter` in the meal-name input on `MealPairingView.vue`'s "create new meal" form submit the form or interact with an open autocomplete list first?)
- [ ] Tests cover: arrow-key highlight movement (including wrap-around), `Enter` selection, `Escape` revert, and the resolved `Enter`-in-form-vs-`Enter`-in-list-open behavior for each of the three mini-forms (`MealPairingView` add-meal, `MealPairingView` create-meal, `WineFormView` create-appellation)

## Comments

A prior "update design" styling commit (`4cd65b7`) accidentally shipped a first pass at this — `ArrowDown`/`ArrowUp`/`Enter`/`Escape` handling and ARIA `combobox`/`listbox` wiring in `AutocompleteField.vue`, plus `Enter`-to-submit on the "add meal"/"create meal" forms in `MealPairingView.vue` and the "create appellation" input in `WineFormView.vue`. That code was reverted (no acceptance criteria, no test coverage, bundled into an unrelated commit) — this ticket is where it should have started. The reverted diff is a reasonable starting point for the implementation, not a spec.
