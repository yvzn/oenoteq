# 01: Slot-based filter bar (prefactor)

**What to build:** The cellar list's filters, "ready now" toggle and sort keep looking and working exactly as today, but the filter bar no longer knows about the cellar list. The filter fields render only the common filters (meal, appellation, color) plus a scoped slot for page-specific extra filters; the cellar list passes its "ready now" toggle through that slot. This makes the filter bar reusable by the Consumption History page (spec: `.scratch/consumption-history/spec.md`, "Filter bar becomes slot-based").

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A common filters type (meal, appellation, color) exists; the cellar list's search filters are the common filters plus "ready now"
- [x] The filter fields component renders meal, appellation and color only, plus a scoped slot exposing the filters being edited, an update function and the testid suffix
- [x] The filter bar is generic over the filters type and forwards the slot into both its desktop inline form (live filters) and mobile panel (draft filters)
- [x] Active filter count is derived generically (fields that are not null/false), so "ready now" still counts on the cellar list
- [x] Empty filters value, sort axes, axis labels and default sort are props, no longer hard-wired to the cellar list's values
- [x] "Ready now" is its own small component, passed through the slot by the cellar list; existing test ids (`ready-now-filter`, `ready-now-filter-mobile`, …) are unchanged
- [x] Existing filter bar and cellar list tests pass unchanged
- [x] New filter bar test: with no slot content there is no "ready now" toggle, sort axes come from props, and active count and clear work

## Comments

- Existing filter bar test assertions are unchanged; only the `mountFilterBar` helper now passes the four new required props (cellar values), since defaulting them would keep the bar hard-wired.
- The bar is also generic over the sort axis type, so the history page can bring its own axes. The slot scope also exposes `inline`, which "ready now" needs to keep its desktop alignment.
- Still cellar-named in the bar: the `cellar.filters.*` / `cellar.sort.*` i18n keys. Worth moving to a shared namespace when the history page starts using the bar.
