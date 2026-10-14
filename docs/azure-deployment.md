# Azure deployment (first manual deploy)

Decision record: `docs/adr/0008-azure-container-apps-deployment.md`. Infra is `infra/main.bicep`, driven by `infra/deploy.sh`. Backup details: `docs/backup-and-restore.md`.

## What gets created

- Resource group, storage account (Standard_LRS) with Blob container `backups`, 30-day lifecycle delete as backstop for Litestream's 7-day retention.
- Container Apps environment (no Log Analytics, to avoid ingestion cost) and one app: 0.25 vCPU / 0.5 GiB, **min 0 / max 1 replica** (scale to zero; Litestream restores on each cold start), single active revision, HTTPS-only external ingress on 8080.
- Entra app registration, single tenant (current tenant). Easy Auth uses the tenant issuer and `allowedApplications` = the app's own client id, so only accounts of this tenant, with tokens issued for this app, get in. No per-user allow-list.
- Easy Auth: `RedirectToLoginPage`, `excludedPaths` = `/manifest.webmanifest`, `/sw.js`, `/icons`, `/icons/*` (manifest and icons are fetched without cookies, so install needs them open; `/icons/*` wildcard unverified on Container Apps, check on real Azure).
- Image pulled from GHCR **anonymously**: after the first tag build, set the package visibility to public (GitHub package settings). For private, add `registries` plus a read-only PAT secret to the Bicep.

## Deploy

```sh
az login
IMAGE=ghcr.io/yvzn/oenoteq:<tag> sh infra/deploy.sh
```

Re-running is safe (resources are updated, a new client secret replaces the previous one, since Entra allows only 2 per app). Logs: `az containerapp logs show -g cellar-rg -n cellar-app --follow`.

## Verify on real Azure (also carried over from ticket 03)

- App answers on `https://<fqdn>` and redirects to Microsoft login when anonymous.
- Litestream with the real `https://<account>.blob.core.windows.net` endpoint (the config relies on the empty-endpoint fallback, only verified against Azurite): check blobs appear in `backups/cellar`.
- Write data, restart the revision (`az containerapp revision restart`), data still present.
- `az containerapp show -g cellar-rg -n cellar-app --query properties.template.scale` shows min 0 / max 1.
- Cold start: scale to zero (wait for idle), then time the first request; record it here. If noticeable, set `minReplicas: 1` in `infra/main.bicep`.
- Graceful scale-down flushes Litestream: write data, let it scale to zero, restart, data present.
- During a revision update confirm two replicas never overlap (single active revision mode should prevent it).

## Monthly cost estimate

**Unverified: unit rates are from memory of the Azure Container Apps consumption price list, not read from the pricing page this session. Check before relying on it** (`docs/research/cheap-hosting-go-sqlite.md` notes the API shows rates rounded to 0.0000).

Assumptions: westeurope, 0.25 vCPU / 0.5 GiB, min 0 / max 1, light personal use. Replica billed only while running; free grant per subscription: 180k vCPU-s, 360k GiB-s, 2M requests.

| Item | Estimate |
|---|---|
| vCPU + memory | likely inside the free grant (a few hours of running a day stays well under 180k vCPU-s) |
| Requests | under 2M, 0 |
| Blob storage + transactions (Litestream) | ~USD 0.1 to 0.5 |
| Default domain + managed HTTPS | 0 |
| **Total** | **~USD 0.1 to 0.5** |

Matches the research file's scale-to-zero figure for Azure. Fallback `minReplicas: 1` (always on) costs about USD 4 to 5 a month more (0.25 vCPU idle + 0.5 GiB for 2.59M s, minus the free grant). Fly.io (~USD 2.4) remains the alternative the research ranked first.

## Release procedure (tag to live)

One-time setup:

1. Run `az login` and `gh auth login`, then `GITHUB_REPO=<owner>/<repo> sh infra/setup-github-oidc.sh`. It looks up the owner and repo IDs with `gh api`, then creates (or updates) an Entra app with a federated credential (subject `repo:<owner>@<ownerId>/<repo>@<repoId>:environment:production`) and Contributor on `cellar-rg` only. No client secret is stored in GitHub.
2. Create GitHub environment `production`; add the three printed values as repo variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
3. Do the first manual deploy above, so the app exists.

Release:

First run the E2E before releasing: `cd web && npm run e2e` (see README). No CI job gates it yet; the first regression that slips past local runs gets a CI job.

```sh
git tag v1.2.3 && git push origin v1.2.3
```

`Release` workflow builds the Windows exe (GitHub Release) and the image (GHCR `:v1.2.3` and `:latest`), then `deploy.yml` runs `az containerapp update --image ghcr.io/<repo>:v1.2.3`. It then polls until the latest revision runs that image and is the latest *ready* revision (10 min max). Readiness comes from the Startup/Readiness probes on `GET /health` in `infra/main.bicep` (Easy Auth does not apply to platform probes). Re-run `infra/deploy.sh` once so the probes exist before the first tag deploy.

Failure: app runs in single revision mode, so traffic stays on the previous revision until the new one is ready. If the new one never becomes healthy the workflow fails and prints recent logs; the old revision keeps serving. Inspect with `az containerapp revision list -g cellar-rg -n cellar-app -o table`.

Redeploy or roll back: GitHub Actions > Deploy > Run workflow, enter an existing tag (e.g. `v1.2.2`). Concurrent deploys are serialised.

Caveat: Container Apps' single mode starts the new revision before retiring the old one, so two replicas may briefly overlap during rollout. Litestream restores on start and the old replica stops shortly after, but this is not a hard single-writer guarantee. Verify on real Azure (checklist above); if overlap is a problem, switch to deactivate-first (brief downtime, no fallback to previous revision).

Untested on real Azure: behaviour of `az containerapp update` while the app is scaled to zero (no replica to probe), and whether a failed deploy leaves the Release run red (the exe release job is independent and still publishes).

## PWA behind Easy Auth

Code side: excluded paths above, and `navigateFallbackDenylist: [/^\/\.auth\//]` in `web/vite.config.ts` so the service worker does not answer `/.auth/*` navigations with the cached `index.html` (that made `/.auth/me` show the SPA home page instead of the login flow). No client change was needed (unverified on real Azure): with `RedirectToLoginPage`, an expired session most likely makes Easy Auth answer API calls with a 302 to `login.microsoftonline.com`, which `fetch` rejects cross-origin. `web/src/api/client.ts` already maps that to `ApiError` status 0, which the sync handlers treat as retryable, so the outbox item stays pending. The user sees the generic network error, not "session expired". If the live check shows a 401 instead (e.g. `Return401`), handle it then. Sync resumes on the next app open (post-login redirect reloads the app) or `online` event.

Verify on real Azure with an Android Chrome phone (not yet run):

- `https://<fqdn>/manifest.webmanifest`, `/sw.js` and `/icons/pwa-192x192.png` load in a private window with no login redirect. If `/icons/*` is not honoured, the icon fetch redirects and install fails: list icon paths individually.
- Sign in, SW registers (DevTools remote debugging > Application), Chrome offers install (WebAPK), app cold-starts in airplane mode.
- Gated update (offline-first-pwa/08): deploy a new tag with an empty outbox, app updates on next open; with a queued item, update is held back until the outbox drains.
- Expired session: queue a change, clear the session cookie, go online. Record whether the API call gets a 302 or a 401. Item must stay pending (not failed). Reload, sign in, item syncs.
- `sw.js` imports `workbox-*.js` (and `registerSW.js` is loaded by the page): check these are not redirected when the session is expired. Add to `excludedPaths` if they are.

## Origin cutover (LAN exe to Azure)

IndexedDB is per origin: the Azure origin starts with an empty local DB and an empty outbox. Anything still queued on the old LAN origin is not carried over.

1. Per phone, on the old LAN origin: go online to the LAN exe, open the app, wait until the sync-status page shows an empty outbox (retry or discard failed items).
2. Stop the LAN exe. Copy its `cellar.db` somewhere safe (it is the source of truth).
3. Seed Azure with that DB: with the app scaled to zero, run a throwaway container with the file at `DB_PATH` and Litestream pointed at the production prefix (same procedure as "re-upload that file" in `docs/backup-and-restore.md`), then start the app. Litestream restores it on cold start. If Azure already has data, restore into a new `LITESTREAM_AZURE_PATH` prefix instead, never overwrite the live one.
4. Per phone: open the Azure URL, sign in, install the PWA, let the first pull fill local IndexedDB. Uninstall the old LAN PWA/shortcut afterwards.
