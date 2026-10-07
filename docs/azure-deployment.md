# Azure deployment (first manual deploy)

Decision record: `docs/adr/0008-azure-container-apps-deployment.md`. Infra is `infra/main.bicep`, driven by `infra/deploy.sh`. Backup details: `docs/backup-and-restore.md`.

## What gets created

- Resource group, storage account (Standard_LRS) with Blob container `backups`, 30-day lifecycle delete as backstop for Litestream's 7-day retention.
- Container Apps environment (no Log Analytics, to avoid ingestion cost) and one app: 0.25 vCPU / 0.5 GiB, **min 0 / max 1 replica** (scale to zero; Litestream restores on each cold start), single active revision, HTTPS-only external ingress on 8080.
- Entra app registration, audience personal Microsoft accounts only.
- Easy Auth: `RedirectToLoginPage`, `excludedPaths` = `/manifest.webmanifest`, `/sw.js` (ticket 06 verifies the final list), optional `allowedPrincipals`.
- Image pulled from GHCR **anonymously**: after the first tag build, set the package visibility to public (GitHub package settings). For private, add `registries` plus a read-only PAT secret to the Bicep.

## Deploy

```sh
az login
IMAGE=ghcr.io/yvzn/oenoteq:<tag> sh infra/deploy.sh
```

Re-running is safe (resources are updated, a new client secret is appended). Logs: `az containerapp logs show -g cellar-rg -n cellar-app --follow`.

## Spike: does `allowedPrincipals` block a non-listed personal account? (~15 min, not yet run)

1. Deploy with no `ALLOWED_OIDS`. Sign in with account A, then account B (private window). Both get in: confirms the default hole.
2. Find account A's object id: after signing in, open `https://<fqdn>/.auth/me` and read the `oid` / `http://schemas.microsoft.com/identity/claims/objectidentifier` claim.
3. Redeploy with `ALLOWED_OIDS="<oid of A>"`. Retry A (should work) and B in a fresh private window (should be refused, 403).
4. Record the result below. If B still gets in, use the fallback from the ticket: app-side allowlist on `X-MS-CLIENT-PRINCIPAL-NAME` (own ticket), or a tenant-only app registration.

Result: **TODO, needs a real Azure subscription and two Microsoft accounts.**

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

1. Run `az login`, then `GITHUB_REPO=<owner>/<repo> sh infra/setup-github-oidc.sh`. It creates an Entra app with a federated credential (subject `repo:<owner>/<repo>:environment:production`) and Contributor on `cellar-rg` only. No client secret is stored in GitHub.
2. Create GitHub environment `production`; add the three printed values as repo variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
3. Do the first manual deploy above, so the app exists.

Release:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

`Release` workflow builds the Windows exe (GitHub Release) and the image (GHCR `:v1.2.3` and `:latest`), then `deploy.yml` runs `az containerapp update --image ghcr.io/<repo>:v1.2.3`. It then polls until the latest revision runs that image and is the latest *ready* revision (10 min max). Readiness comes from the Startup/Readiness probes on `GET /health` in `infra/main.bicep` (Easy Auth does not apply to platform probes). Re-run `infra/deploy.sh` once so the probes exist before the first tag deploy.

Failure: app runs in single revision mode, so traffic stays on the previous revision until the new one is ready. If the new one never becomes healthy the workflow fails and prints recent logs; the old revision keeps serving. Inspect with `az containerapp revision list -g cellar-rg -n cellar-app -o table`.

Redeploy or roll back: GitHub Actions > Deploy > Run workflow, enter an existing tag (e.g. `v1.2.2`). Concurrent deploys are serialised.

Caveat: Container Apps' single mode starts the new revision before retiring the old one, so two replicas may briefly overlap during rollout. Litestream restores on start and the old replica stops shortly after, but this is not a hard single-writer guarantee. Verify on real Azure (checklist above); if overlap is a problem, switch to deactivate-first (brief downtime, no fallback to previous revision).

Untested on real Azure: behaviour of `az containerapp update` while the app is scaled to zero (no replica to probe), and whether a failed deploy leaves the Release run red (the exe release job is independent and still publishes).
