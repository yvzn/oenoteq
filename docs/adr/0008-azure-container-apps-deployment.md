---
status: accepted
supersedes: 0002-single-exe-embedded-deployment.md
---

# Deploy to Azure Container Apps behind Easy Auth, SQLite on local disk replicated by Litestream

The LAN deployment of ADR 0002 cannot register a service worker: users reach the exe over plain `http://192.168.x.x`, which is not a secure context in Chrome, so the offline-first PWA (ADR 0006) loses its offline shell, install and gated update. Rather than per-phone Chrome flags or a private CA, the app moves to a public HTTPS URL.

The Go binary keeps its embedded-SPA single-binary shape and is packaged in a container image and run on **Azure Container Apps** (consumption plan, `*.azurecontainerapps.io` managed HTTPS, custom domain optional). Authentication is the platform's **Easy Auth** with **Microsoft Entra ID, single tenant** as the identity provider; the image is published to **GHCR** and the app uses the default `*.azurecontainerapps.io` domain. The app contains no auth code: locally there is no login, and in Azure the platform sidecar gates all traffic. Sign-in is restricted to the owner's tenant by platform configuration (tenant issuer, `allowedApplications` = the app's own client id); no per-user allow-list.

SQLite stays (pure-Go `modernc.org/sqlite`, WAL, single connection) on the container's **local disk**. **Litestream** replicates it continuously to Azure Blob Storage and restores it on cold start. Max replicas is 1 so there is never more than one writer; min replicas is 0 (scale to zero) because low price is the top priority, accepting a Litestream restore on each cold start. If that restore time becomes noticeable, set min replicas to 1 (about USD 4 a month more, see `docs/azure-deployment.md`). The database is never placed on Azure Files: WAL needs shared memory and reliable locks, which SMB mounts do not guarantee, and the only supported-looking alternative (NFS on Premium storage) costs more than the rest of the stack. Chosen because low price is the top priority and real user data now exists, so backups are non-negotiable. See `docs/research/cheap-hosting-go-sqlite.md` and `docs/research/service-workers-on-lan.md`.

The Windows exe release (ADR 0002) keeps working: port, auth mode and Litestream are all config, defaulting to the old behaviour. Revisit (set min replicas to 1) if cold-start restore time becomes noticeable; revisit the whole design if the app needs more than one replica or if Container Apps pricing changes materially.

Consequences to handle in implementation: Easy Auth redirects unauthenticated requests, so `manifest.webmanifest` and the service worker script need excluding or verifying; changing origin from the LAN IP gives a fresh IndexedDB, so each phone's outbox must be drained before switching.

Amendment (deploy pipeline, ticket 05): "never more than one writer" holds per revision. In single revision mode Container Apps may briefly run the old and new revision together during a rollout. Accepted for now (Litestream restores from the replica on start); revisit with deactivate-first rollout if overlap causes corruption or lost writes.
