# 01: Data gateway prefactor

**What to build:** a single data gateway that every composable calls for reads and writes of Wines, Consumptions, quantity adjustments, Producers, Appellations, Meals, Meal Pairings and the cellar search. The current local store, outbox and sync move behind it as the local-first adapter, with no change in behavior. This is the seam ADR 0010 needs to later swap in a direct-to-server adapter. If the offline wine list effort has not landed, the cellar list read is the gateway's first operation, with the same shape. See `.scratch/storage-consent/spec.md` and ADR 0010.

**Blocked by:** `.scratch/e2e/issues/01-playwright-harness-and-offline-create-tracer.md` (characterization net for the sync layer before it is reworked; if that ticket is dropped by its time-box, this edge is removed)

**Status:** done

- [x] One gateway interface covering every entity read and write the app performs today, including the cellar search, quantity adjustment and consumption create/update/delete
- [x] The existing local-first behavior (local store first, outbox, background push, id remapping, "pending" state) lives in one adapter implementing that interface; no behavior change
- [x] No composable or view imports the local store or calls the API client for entity data directly; everything goes through the gateway
- [x] The active adapter is resolved in one place; for now it is always the local-first adapter
- [x] Contract tests are written once against the gateway interface and run against the local-first adapter: list/get/create/update for each entity, quantity adjustment, consumption create/update/delete, search with filters and sorts, errors surfacing as friendly errors. Where adapters will legitimately differ (outbox, local ids, pending state) the contract states the difference explicitly
- [x] Every existing test passes unchanged (same assertions, same mocks at the API-client and fake IndexedDB boundaries)
- [x] No API, schema or `api.http` change

## Comments

- `web/src/gateway/`: `DataGateway` interface (`types.ts`), local-first adapter, active adapter resolved in `index.ts`. Contract in `gatewayContract.ts`, run against local-first in `localFirstGateway.test.ts` using `test/fakeServer.ts`.
- `useSyncPending` / `useSyncStatus` still read the outbox directly (sync-status data, not entity data); revisit when the direct adapter lands.
- Cellar list read is `gateway.search` (ADR 0009 not landed).
