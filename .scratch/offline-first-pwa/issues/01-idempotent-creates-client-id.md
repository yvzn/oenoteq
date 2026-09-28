# 01: Idempotent creates via client_id

**What to build:** Wine, Consumption, Producer, Appellation, and Meal creation accept an optional client-generated `client_id`. Posting the same `client_id` twice never creates a duplicate row — the second request returns the existing row as-is. Every one of these entities also gets a server-assigned `updated_at`, set at ingest, returned in every response.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Migration adds a nullable, unique `client_id` column to wine, producer, appellation, meal, and consumption (additive — no table recreation needed for this change)
- [ ] Migration adds a server-managed `updated_at` column to the same five tables, set on every insert and update
- [ ] Create handlers for all five entities accept an optional `client_id` in the request body
- [ ] A create request with a `client_id` matching an existing row returns that existing row (same shape as a normal create response) instead of erroring or duplicating
- [ ] A create request without a `client_id` behaves exactly as it does today (field stays optional, no forced client-side ID generation)
- [ ] `updated_at` is present in every GET/POST/PUT response for these five entities
- [ ] `api.http` updated with example requests showing `client_id` usage for each of the five create endpoints
- [ ] Handler tests cover: first create with a `client_id` succeeds, retried create with the same `client_id` returns the original row, two different `client_id`s create two distinct rows
