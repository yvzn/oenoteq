# 03: Quantity as delta events

**What to build:** `Wine.quantity` is no longer an absolute number a client can set directly. Consumption creation still decrements it by one, but now idempotently by `client_id`. A new endpoint lets the client apply a manual quantity correction as a signed delta, also idempotent by `client_id`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `quantity` removed from Wine's create and update request bodies — sending it has no effect (field is simply not read)
- [ ] New endpoint for a manual quantity adjustment: accepts `client_id`, signed `delta`, reason fixed to `"manual"`; applies atomically to the wine's quantity
- [ ] Manual adjustment endpoint rejects a delta that would take quantity below zero, using the same conflict behavior as today's `ErrQuantityZero`
- [ ] Manual adjustment endpoint is idempotent: retrying the same `client_id` does not re-apply the delta
- [ ] Consumption creation's existing `-1` decrement is now guarded by the Consumption's own `client_id` — retrying a consumption create does not double-decrement
- [ ] New `quantity_adjustment` table (or equivalent) persists manual adjustments only — Consumption rows remain the sole record of consumption-driven changes, no duplicated ledger entry
- [ ] `api.http` updated: Wine create/update examples no longer show `quantity`; new manual quantity-adjustment endpoint documented
- [ ] Existing wine/consumption handler tests updated to match the new contract; new tests cover manual adjustment (apply, reject-below-zero, idempotent retry) and consumption idempotent decrement
