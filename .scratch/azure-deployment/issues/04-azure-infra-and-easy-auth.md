# 04: Azure infrastructure and Easy Auth

**What to build:** Container Apps environment, app (min 1 / max 1 replica), storage account + Blob container for Litestream, managed identity or secret for Blob access, Easy Auth with the chosen identity provider. Provisioning scripted (az CLI or Bicep) so it is repeatable. The automated deploy pipeline is ticket 05; this ticket ends with a first manually deployed, working app.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Decisions:** identity provider = Microsoft personal accounts (Entra app registration, audience "personal Microsoft accounts only"); registry = GHCR; domain = default `*.azurecontainerapps.io`.

- [ ] App reachable over HTTPS on the `*.azurecontainerapps.io` URL, login required
- [ ] `AUTH_MODE=easyauth` set; only intended users can sign in. Easy Auth alone lets ANY Microsoft personal account sign in, so the app enforces an allowlist of permitted identities from config (`AUTH_ALLOWED_USERS`), 403 otherwise
- [ ] Container Apps pulls the image from GHCR (public image, or private with a read-only pull token stored as a secret)
- [ ] Replica count pinned to exactly one writer
- [ ] Monthly cost estimate recorded against the research file
