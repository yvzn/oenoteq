# Wine Cellar Tracker — MVP

Status: ready-for-agent

## Problem Statement

The user owns a wine cellar and has no way to see what they own, know when a wine is at its best to drink, or quickly find a wine that fits a meal they're about to cook. Decisions about what to open are currently made from memory or by inspecting physical labels, with no record of what's already been drunk or how it tasted.

## Solution

A self-hosted, single-user web app for tracking the cellar. The user records each Wine they own (with its drinking window and quantity), maintains a reusable pairing lookup from appellation+color to meals, logs a Consumption each time a bottle is opened, and searches the cellar with combinable filters (meal, appellation, color, "ready to drink now") to decide what to open next. No login — it's reachable from the user's phone on their home network.

## User Stories

### Wine management

1. As a cellar owner, I want to add a new Wine with millesime, appellation, producer, color, garde range, and quantity, so that I can record a wine I've bought.
2. As a cellar owner, I want millesime to be optional when adding a Wine, so that I can record non-vintage wines (e.g. Champagne NV).
3. As a cellar owner, I want to edit any field of an existing Wine, so that I can correct a data entry mistake.
4. As a cellar owner, I want to see a list of all Wines in my cellar with their quantity, so that I can see what I own at a glance.
5. As a cellar owner, I want to open a single Wine's detail view showing millesime, appellation, producer, color, garde, quantity, and its Consumption history, so that I can decide whether to drink it.
6. As a cellar owner, I want a Wine to remain visible even once its quantity reaches 0, so that I can still see what I've had and how it rated.

### Reference data (Appellation, Meal)

7. As a cellar owner, I want to pick a Wine's appellation from a maintained list rather than typing free text, so that meal pairing lookups stay consistent.
8. As a cellar owner, I want to add a new Appellation to the list, so that I'm not blocked from entering a wine from a region I haven't tracked before.
9. As a cellar owner, I want to pick a Wine's color from a fixed set (rouge, blanc, rose), so that meal pairing lookups work reliably.
10. As a cellar owner, I want to maintain a list of Meals (add new ones), so that I can build out pairing suggestions over time.

### Meal Pairing

11. As a cellar owner, I want to associate one or more Meals with an (appellation, color) pair, so that any Wine of that appellation and color automatically suggests those meals.
12. As a cellar owner, I want to edit the Meals associated with an (appellation, color) pair, so that I can refine suggestions as my knowledge improves.
13. As a cellar owner, I want a Wine's suggested meals to be derived automatically from its (appellation, color) Meal Pairing rather than entered per-wine, so that I don't redundantly re-enter the same pairing for every bottle of the same appellation and color.

### Consumption

14. As a cellar owner, I want to record a Consumption for a Wine with a date (required), rating 1–5 (optional), and notes (optional), so that I can track when and how I drank it.
15. As a cellar owner, I want recording a Consumption to decrement the Wine's quantity by 1, so that my on-hand count stays accurate.
16. As a cellar owner, I want to be prevented from recording a Consumption when a Wine's quantity is already 0, so that quantity never goes negative.
17. As a cellar owner, I want to view a Wine's full Consumption history (all past events with their dates, ratings, and notes), so that I can recall how it tasted before deciding to open another one.

### Search / recommendation

18. As a cellar owner, I want to search my cellar with combinable filters — meal, appellation, color, "in garde window now" — so that I can quickly find something to drink for a specific occasion.
19. As a cellar owner, I want the selected filters to AND together, not OR, so that results narrow down precisely.
20. As a cellar owner, I want to search by "in garde window now" alone, with no meal or appellation selected, so that I can browse everything ready to drink regardless of occasion.
21. As a cellar owner, I want to search by a specific appellation alone, with no meal selected, so that I can browse everything I own from that region.
22. As a cellar owner, I want Wines outside their garde window (too young, or past peak) to be flagged in results rather than hidden, so that I still know about a wine that's over the hill and should be drunk soon.
23. As a cellar owner, I want search results to exclude Wines with quantity 0 by default, so that suggestions are things I can actually go open.

### Access

24. As a cellar owner, I want to reach the app from my phone's browser while at home, so that I can look up a pairing at the table or in the kitchen.
25. As a cellar owner, I want no login screen, so that a single-user personal tool has no unnecessary friction.

## Implementation Decisions

- **Backend**: Go service exposing an HTTP API, backed by SQLite. No authentication/session layer (single implicit user, per decision).
- **Frontend**: Vue SPA consuming the API. Not built as part of this spec (see Out of Scope) — this spec covers the API and its behavior.
- **Wine**: fields `millesime` (nullable int), `appellation` (reference to Appellation), `producer` (free text), `color` (enum: rouge/blanc/rose), `garde_debut`/`garde_fin` (ints, drinking window), `quantity` (int, ≥ 0). Per **ADR-0001**, there is no per-bottle entity or identity — a Wine's `quantity` is a simple count, decremented by Consumption events. A Wine record is never deleted by reaching quantity 0.
- **Appellation**: maintained reference list (id, name), not free text — required so it can key the Meal Pairing lookup consistently.
- **Meal**: maintained reference list (id, name), not free text — same reason.
- **Color**: fixed 3-value enum (rouge, blanc, rose), not a maintained/extensible list.
- **Meal Pairing**: a many-to-many mapping from (appellation, color) to Meal — one appellation+color pair can list multiple Meals. This is the single source of pairing suggestions; individual Wines do not carry their own custom meal list (rejected during design — see prior grilling session).
- **Consumption**: fields `wine_id`, `date` (required), `rating` (nullable, 1–5), `notes` (nullable text). Creating a Consumption decrements the parent Wine's `quantity` by 1 in the same operation. Attempting to create one when `quantity` is already 0 must be rejected (no negative quantity).
- **Recommendation/search endpoint**: accepts independent optional filters — `meal`, `appellation`, `color`, `ready_now` (in garde window as of today) — combined with AND semantics. Excludes Wines with `quantity = 0` by default. Each result carries a garde status of `too_young` / `ready` / `past_peak` (derived from today's date vs. `garde_debut`/`garde_fin`); `too_young` and `past_peak` results are included and flagged, never filtered out by the `ready_now` filter's absence — `ready_now` only restricts to `ready` when explicitly set.
- **Deployment**: self-hosted on the user's home server, reachable from other devices on the home network (e.g. phone). Not covered by this spec — infrastructure/deployment is a separate concern.

## Testing Decisions

- **Seam**: the Go HTTP handler layer, tested against a real SQLite database (temp-file or in-memory) — no mocking of storage. A good test drives an HTTP request in and asserts on the HTTP response and on subsequently-observable state (via further API calls), never on internal function calls or SQL directly.
- **Modules tested through this seam**: Wine CRUD endpoints, Appellation and Meal reference-list endpoints, Meal Pairing endpoints, Consumption endpoint (including the quantity-decrement side effect and the zero-quantity rejection), and the recommendation/search endpoint (filter combinations, AND semantics, garde-status flagging, quantity=0 exclusion).
- **Prior art**: none — this is a greenfield repo; this spec establishes the pattern for tests going forward.

## Out of Scope

- Vue frontend implementation and its tests (a follow-up spec once this API exists and is stable).
- Storage location / bin tracking within the cellar.
- Authentication, login, or multi-user support.
- Deleting a Wine record outright (only field edits and quantity changes via Consumption are specified).
- Editing or deleting a past Consumption event once recorded (append-only for v1).
- Per-wine custom meal pairing overrides (explicitly rejected in favor of the shared appellation+color lookup).
- Deployment/infrastructure setup for the home server.

## Further Notes

- Domain vocabulary (Wine, Millesime, Garde, Appellation, Color, Meal Pairing, Consumption) is defined in `CONTEXT.md` at the repo root — use those terms, not synonyms, throughout implementation.
- **ADR-0001** records the decision to model Wine as a reference+quantity rather than per-bottle instances; do not introduce per-bottle identity while implementing this spec.
- This spec resulted from a grilling session with the user (see conversation history) covering scope, tracking-unit modeling, garde semantics, meal-pairing structure, consumption tracking, search behavior, and deployment/access — all decisions above trace back to explicit user answers, not assumptions.
