# Azure deployment (first manual deploy)

Decision record: `docs/adr/0008-azure-container-apps-deployment.md`. Infra is `infra/main.bicep`, driven by `infra/deploy.sh`. Backup details: `docs/backup-and-restore.md`.

## What gets created

- Resource group, storage account (Standard_LRS) with Blob container `backups`, 30-day lifecycle delete as backstop for Litestream's 7-day retention.
- Container Apps environment (no Log Analytics, to avoid ingestion cost) and one app: 0.25 vCPU / 0.5 GiB, **min 1 / max 1 replica**, single active revision, HTTPS-only external ingress on 8080.
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
- `az containerapp show -g cellar-rg -n cellar-app --query properties.template.scale` shows min 1 / max 1.

## Monthly cost estimate

**Unverified: unit rates are from memory of the Azure Container Apps consumption price list, not read from the pricing page this session. Check against the pricing page / Retail API before relying on it** (`docs/research/cheap-hosting-go-sqlite.md` notes the API shows rates rounded to 0.0000).

Assumptions: westeurope, 0.25 vCPU / 0.5 GiB, always on (min 1), near-zero traffic so the replica is mostly in the cheaper *idle* state. Free grant per subscription: 180k vCPU-s, 360k GiB-s, 2M requests.

| Item | Usage / month | Estimate |
|---|---|---|
| vCPU (idle rate, ~0.000003 USD/s) | 0.25 x 2.59M s = 648k, minus 180k free | ~USD 1.4 |
| Memory (~0.000003 USD/GiB-s) | 0.5 x 2.59M s = 1.3M, minus 360k free | ~USD 2.8 |
| Requests | well under 2M | 0 |
| Blob storage + transactions | under 1 GB, Litestream writes | ~USD 0.1 to 0.5 |
| Default domain + managed HTTPS | | 0 |
| **Total** | | **~USD 4 to 5** |

Note this is above the research file's scale-to-zero figure (~EUR 0.02): min 1 gives up scale-to-zero, which the ADR chose to avoid cold-start restore. Fly.io (~USD 2.4) remains the cheaper alternative the research ranked first.
