# 04: Azure infrastructure and Easy Auth

**What to build:** Container Apps environment, app (min 0 / max 1 replica, scale to zero), storage account + Blob container for Litestream, managed identity or secret for Blob access, Easy Auth with the chosen identity provider. Provisioning scripted (az CLI or Bicep) so it is repeatable. The automated deploy pipeline is ticket 05; this ticket ends with a first manually deployed, working app.

**Blocked by:** 02, 03

**Status:** in-progress (infra scripted; needs real Azure run, see docs/azure-deployment.md)

**Decisions:** identity provider = Microsoft personal accounts (Entra app registration, audience "personal Microsoft accounts only"); registry = GHCR; domain = default `*.azurecontainerapps.io`.

- [ ] App reachable over HTTPS on the `*.azurecontainerapps.io` URL, login required
- [ ] Auth config: `unauthenticatedClientAction` = `RedirectToLoginPage`, `excludedPaths` covers what the PWA needs unauthenticated (manifest, service worker script; see ticket 06)
- [ ] Only intended users can sign in, enforced by platform config, no app code. First try `identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedPrincipals.identities`. **Spike first (about 15 min):** confirm it actually blocks a second, non-listed personal Microsoft account. The docs do not say how identities are expressed for personal accounts, and Entra "Assignment required" is documented for tenant users only. Without a restriction any personal Microsoft account can sign in
- [ ] If the spike fails: fall back to a minimal app-side check of `X-MS-CLIENT-PRINCIPAL-NAME` against an allowlist (about 20 lines, own ticket), or use a tenant-only app registration
- [ ] Container Apps pulls the image from GHCR (public image, or private with a read-only pull token stored as a secret)
- [ ] Replica count capped at one writer (max 1), min 0; measure cold-start restore time on the first deploy
- [ ] Monthly cost estimate recorded against the research file
