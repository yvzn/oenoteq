# 05: Offline Consumption recording + manual quantity adjustment

**What to build:** recording a Consumption, editing one, and manually correcting a Wine's quantity all work offline, using the delta-event mechanism from ticket 03 and the outbox foundation from ticket 04.

**Blocked by:** 03, 04

**Status:** done

- [x] Recording a Consumption offline (date required, rating/notes optional) queues it in the outbox and immediately decrements the displayed quantity by one, locally
- [x] Editing a Consumption's rating/notes works offline (LWW field-patch), queued the same way
- [x] Canceling a Consumption still sitting unsent in the local outbox removes it from the queue entirely — no server call, since nothing was pushed yet
- [x] A Wine blocked at quantity zero still can't have a new Consumption recorded, offline or online, same as today's behavior
- [x] Manually adjusting a Wine's quantity (stock correction) works offline, queued as a signed delta, reflected immediately in the local display
- [x] Both consumption-driven and manual quantity changes sync correctly once back online, and a retried sync of either never double-applies
- [x] Wine Detail's consumption history and quantity stay consistent with the local store while offline (no stale numbers)
- [x] Component tests cover: offline consumption recording updates quantity immediately, offline consumption cancel-before-sync, offline manual quantity adjustment

## Comments

- New `src/sync/consumptionSync.ts` mirrors `wineSync.ts`'s pattern: an outbox handler per entity (`consumption`, `quantity_adjustment`), enqueue/patch/cancel helpers, and a `pushConsumptions()` replay entry point. `useWines`'s `recordConsumption`/`updateConsumption`/`deleteConsumption` are rebuilt local-first on top of it, and a new `adjustQuantity` covers manual corrections — there was no existing manual-adjustment UI at all, so a small form was added to `WineDetailView` alongside the consumption form.
- A consumption or quantity adjustment against a wine that itself hasn't synced yet (negative local id) resolves the real wine id at push time via the same `idRemap` breadcrumb `wineSync.ts` already leaves behind — this relies on `pushWines()` always being flushed before `pushConsumptions()` in the same pass (see `pushChangesInBackground` / `sync/index.ts`), so a dependent item never resolves before its wine's create has had a chance to run.
- Canceling only ever dequeues a not-yet-synced consumption (negative id); a consumption that has already synced still goes through the existing online-only `DELETE /consumptions/:id` call, unchanged from before this ticket — deletes stay online-only per the spec.
- The zero-quantity guard for recording a consumption is now enforced client-side against the local `wine.quantity` (same as the UI's existing form-hiding behavior), rather than round-tripping to the server to find out.
- Known gap, carried from ticket 04's scope: the background `pullWines()` only re-fetches the Wine list (id/quantity/fields), not each wine's `consumption_history` — that's only refreshed by visiting a wine's own Detail page while online (`load()` → `pullWine(id)`). So a consumption logged on a *second* device won't show up in this device's history until that wine's detail page is opened online. The spec's "Pull" bullet describes fetching full consumption state too, but there's no flat consumptions endpoint to pull from (backend only exposes per-wine create/update/delete), so a real fix here is backend-scoped and out of this ticket — flagging rather than silently leaving it.
