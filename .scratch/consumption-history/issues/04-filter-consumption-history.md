# 04: Filter Consumption History

**What to build:** On the Consumption History page the user can filter by appellation, color and meal, alone or combined, using the same filter bar as the cellar list (inline form on desktop, panel with count and apply/clear on mobile) but without "ready now". The meal filter matches Consumptions whose Wine's (Appellation, Color) is currently paired with that Meal — a Consumption records no Meal. Filters are kept in the URL. See `.scratch/consumption-history/spec.md`.

**Blocked by:** 03 (Sort Consumption History)

**Status:** done

- [x] `GET /consumptions` accepts `meal_id`, `appellation_id` and `color` with the same names and meaning as `/search`, combinable with each other and with sort
- [x] Meal filter follows current Meal Pairings: editing a pairing changes which past Consumptions match
- [x] `api.http` request updated with filter parameters
- [x] Filter bar on the page shows meal, appellation and color filters, no "ready now"; active count and clear work on desktop and mobile
- [x] Filters reflected in the URL and the request; changing filters resets to page 1 like the cellar list; reload and browser back keep them
- [x] Filtered-empty state: "No consumption matches these filters" with a clear-filters action (the no-filters empty state stays "No consumption recorded yet")
- [x] New text in English and French
- [x] Go handler tests: each filter alone and combined; meal filter follows current pairings; Wines with quantity 0 still match
- [x] View tests: filters change the URL and request; filtered-empty state and clear
