# 06: Offline CRUD for Producer/Appellation/Meal + offline add Meal Pairing

**What to build:** the outbox pattern from ticket 04 extended to Producer, Appellation, and Meal (create and edit), and to adding a Meal Pairing edge. Deletes and pairing-removal are untouched — they stay online-only, exactly as they work today.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `useProducers`, `useAppellations`, `useMeals` rebuilt on the local store + outbox, same pattern as `useWines` from ticket 04
- [ ] Creating and editing a Producer, Appellation, or Meal works fully offline, appears immediately, syncs on reconnect, idempotent via `client_id`
- [ ] Inline reference-data creation (e.g. creating a new Appellation mid-way through the Wine form) works offline
- [ ] Adding a Meal Pairing (appellation + color + meal) works offline, queued via the outbox; add is naturally idempotent on retry via the existing composite key (no `client_id` needed for this one)
- [ ] Removing a Meal Pairing, and deleting a Producer/Appellation/Meal/Wine, all still require connectivity — no offline queueing for any of these, unchanged from today's behavior
- [ ] Component tests updated/added for offline create+edit across Producer/Appellation/Meal views and offline Meal Pairing add
