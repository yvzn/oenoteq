# Azure deployment

Move the app from the LAN exe (ADR 0002) to a public HTTPS URL on Azure Container Apps so service workers work (ADR 0008). Easy Auth for login, SQLite on local disk, Litestream to Azure Blob for backup/restore. Low cost is the top priority; the Windows exe path must keep working with default config.

Sources: `docs/adr/0008-azure-container-apps-deployment.md`, `docs/research/cheap-hosting-go-sqlite.md`, `docs/research/service-workers-on-lan.md`.

Out of scope: swapping the DB engine, multi-replica, Azure Files for the DB.

Tickets: 01 config flags, 02 container image + Linux CI, 03 Litestream backup/restore, 04 Azure infra + Easy Auth (first manual deploy), 05 deploy pipeline (tag to live), 06 PWA behind Easy Auth + origin cutover.
