---
status: accepted
---

# Missing Garde bounds are "unassessed", not defaulted to "ready"

`garde_debut`/`garde_fin` are independently optional. The natural math for a single missing bound is to treat it as unbounded on that side (no start known → can't be `too_young`; no end known → can't be `past_peak`). Applying that same logic when *both* bounds are missing would make every such wine compute as `ready` — extending the "unbounded" reasoning to its limit. We deliberately special-case both-missing as a distinct `unassessed` status instead: no bound set means no judgment has been made at all, not "always ready to drink." This also keeps `unassessed` wines out of the "ready now" search filter, which is meant to mean "confirmed drinkable," not "no opinion." Revisit only if the product ever wants a genuine "drink anytime, no window" concept — that would be a different status from `unassessed`.
