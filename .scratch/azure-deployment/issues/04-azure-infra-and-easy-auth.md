# 04: Azure infrastructure and Easy Auth

**What to build:** Container Apps environment, app (min 0 / max 1 replica, scale to zero), storage account + Blob container for Litestream, managed identity or secret for Blob access, Easy Auth with the chosen identity provider. Provisioning scripted (az CLI or Bicep) so it is repeatable. The automated deploy pipeline is ticket 05; this ticket ends with a first manually deployed, working app.

**Blocked by:** 02, 03

**Status:** done (verified on the real Azure deploy)

**Decisions:** identity provider = Microsoft Entra ID, single tenant (app registration "current tenant only"); registry = GHCR; domain = default `*.azurecontainerapps.io`.

- [x] App reachable over HTTPS on the `*.azurecontainerapps.io` URL, login required
- [x] Auth config: `unauthenticatedClientAction` = `RedirectToLoginPage`, `excludedPaths` covers what the PWA needs unauthenticated (manifest, service worker script; see ticket 06)
- [x] Only the owner's tenant can sign in, enforced by platform config, no app code: tenant issuer + `defaultAuthorizationPolicy.allowedApplications` = own client id
- [x] Container Apps pulls the image from GHCR (public image, or private with a read-only pull token stored as a secret)
- [x] Replica count capped at one writer (max 1), min 0; measure cold-start restore time on the first deploy
- [x] Monthly cost estimate recorded against the research file
