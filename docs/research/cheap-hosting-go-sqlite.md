# Cheapest internet hosting for the Go + SQLite cellar app

Researched 2026-10-07. Question: what is the cheapest way to put the app on a public HTTPS URL (so the service worker registers, see `service-workers-on-lan.md`) for under 10 users and tiny data, with real-data-safe backups? Low price is priority #1; swapping the DB engine is allowed.

**Facts that scope the answer (read from repo)**
- Go 1.22, **`modernc.org/sqlite` v1.28.0 (pure Go, no cgo)** (`go.mod`). `CGO_ENABLED=0` cross-compiles to linux/amd64 and linux/arm64 trivially; image can be `scratch`/distroless.
- DB opened with WAL, `busy_timeout`, `synchronous=NORMAL`, `foreign_keys=1`, **one connection** (`internal/db/db.go`). WAL needs shared memory / POSIX locks, so the DB file must live on a **local** disk, never on SMB/NFS/FUSE.
- SQL is plain SQLite: `AUTOINCREMENT`, `PRAGMA foreign_keys/legacy_alter_table` inside a table-rebuild migration (`002_producer.sql`), hand-written SQL in a 40 KB `db.go`. No FTS5 or JSON functions found by grep (not a full audit).
- Config: `DB_PATH` env (default: beside the exe). **Port is hard-coded `:8080`** (`main.go`), no TLS, no env override. 10 s read/write timeouts.
- **No Dockerfile exists.** CI (per ADR 0002) only builds `windows/amd64`; a Linux target would be new, and ADR 0002 would need amending.
- **No authentication at all** (ADR 0002 "no auth"). On the public internet anyone with the URL can read and delete the cellar. This is the largest non-cost gap: add auth, or gate with Caddy basic auth / Cloudflare Access (Access free tier **[UNVERIFIED]**, not read on a primary page).
- Data is tiny (`cellar.db` is 88 KB today).

**Source confidence.** Every price carries an inline primary URL read on 2026-10-07. Azure's marketing pages render prices as `$-` for the scraper, so Azure numbers come from the official Azure Retail Prices API (`prices.azure.com`, West Europe, EUR, list price, ex-VAT) and `x730h` is my own arithmetic. **[UNVERIFIED]** marks things I could not confirm from a primary page. All prices are ex-VAT unless stated; EU consumers add VAT (about 20%).

---

## 1. Verdict in one paragraph

Cheapest that is still safe for real data: **Fly.io, one shared-cpu-1x 256 MB machine + 1 GB volume + Litestream to Cloudflare R2 or Backblaze B2, about USD 2.4/month**, using the free `*.fly.dev` HTTPS name. Cheaper (EUR 0) options exist (Cloud Run, Azure Container Apps, Oracle Always Free) but each puts the SQLite file on ephemeral disk or exposes you to reclamation, so they depend on Litestream restore working every cold start. If you want "boring VPS you own": Hetzner CX23/CAX11 IPv6-only (EUR 5.49-5.99) is the best value but is **currently listed unavailable**. Azure is viable but is not cheap for this workload (about EUR 12/month for a VM, or EUR 0 with scale-to-zero containers plus Litestream to Blob).

---

## 2. VPS

| Provider / plan | Price (ex-VAT) | Specs | Source (read 2026-10-07) | Notes |
|---|---|---|---|---|
| **Hetzner CX23** (x86, DE/FI) | EUR 5.49/mo (was 3.99 before 15 Jun 2026) | shared vCPU (specs not shown on fetched pages) | [price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) | Price is "excl. IPv4" so **IPv6-only = 5.49**. Primary IPv4 +EUR 0.50, IPv6 free ([servers overview](https://docs.hetzner.com/cloud/servers/overview/)). Cost-optimized page says "currently not available" ([hetzner.com/cloud](https://www.hetzner.com/cloud/)). |
| **Hetzner CAX11** (ARM) | EUR 5.99/mo (was 4.49) | same source | same | Same availability warning. Pure-Go binary runs on ARM with no change. |
| Hetzner CPX02/CPX12 | prices did not render | 1 vCPU, 1-2 GB | [regular-performance](https://www.hetzner.com/cloud/regular-performance/) | Shown unavailable too. |
| **Vultr** IPv6-only | USD 2.50/mo; USD 3.50 with IPv4 | 1 vCPU, 0.5 GB, 10 GB, 0.5 TB | search snippet of [vultr.com/pricing](https://www.vultr.com/pricing/) (direct fetch returned 403) | Vultr FAQ calls it a "sandbox plan", 2 per account. **[UNVERIFIED]** page itself. |
| **DigitalOcean** Basic | USD 4/mo | 512 MiB, 1 vCPU, 10 GiB, 500 GiB transfer | [droplets pricing](https://www.digitalocean.com/pricing/droplets) | Weekly backups +20% (USD 0.80), daily +30%. Snapshots USD 0.06/GB. |
| **OVH** VPS-1 | from USD 4.54/mo | 2 vCore, 4 GB, 40 GB NVMe | [ovhcloud.com/en/vps](https://www.ovhcloud.com/en/vps/) | Page does not state VAT or term (link hints 12-month upfront). Daily backup of last 24 h included. |
| **Contabo** Cloud VPS 4 | EUR 5.50/mo only on 24-month term | 4 vCPU, 8 GB, 100 GB | [contabo.com/en/vps](https://contabo.com/en/vps/) | Overkill; 1-month term price not shown. |
| **Scaleway** STARDUST1-S | EUR 0.0006/h = ~EUR 0.43/mo | 1 vCPU, 1 GB | [virtual-instances](https://www.scaleway.com/en/pricing/virtual-instances/) | IPv4 not included: Additional IP EUR 0.005/h (~EUR 3.65/mo, my arithmetic) per [network pricing](https://www.scaleway.com/en/pricing/network/). So ~EUR 4/mo with IPv4, ~EUR 0.43 IPv6-only. Stardust availability per zone **[UNVERIFIED]**. |
| **Oracle Always Free** | EUR 0 | AMD Micro 1/8 OCPU, 1 GB (x2); or Ampere A1 up to 2 OCPU / 12 GB total; 200 GB storage, 10 TB egress | [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) | See caveats below. |
| **Azure B2pts v2** (ARM, Linux) | EUR 0.0084/h = **6.13/mo** | 2 vCPU burstable | [Retail Prices API](https://prices.azure.com/api/retail/prices?currencyCode=EUR&$filter=armRegionName%20eq%20'westeurope'%20and%20serviceName%20eq%20'Virtual%20Machines') | Plus E4 Standard SSD disk EUR 2.11 + 0.30 mount, plus static IPv4 EUR 0.0044/h = 3.21 (Basic dynamic 0.0035/h = 2.56). **About EUR 11.7/mo all-in.** B1ls (EUR 0.0053/h = 3.87) about EUR 9.5 all-in. B2ats v2 EUR 6.94, B1s EUR 7.74. |

### Oracle Always Free caveats
- **Idle reclamation**: Oracle may reclaim Always Free instances idle for 7 days, defined as 95th-percentile CPU below 20% **and** network below 20% **and** (A1 only) memory below 20% ([doc](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)). A tiny personal app is idle by that definition. Real risk of losing the VM; backups mandatory. Upgrading to Pay-As-You-Go keeps the free allowance (only overage billed), and is the commonly cited mitigation, but whether PAYG exempts you from the reclaim rule is **[UNVERIFIED]**.
- Sign-up: "most users need a mobile phone number and a credit card" (not charged unless upgraded) ([Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)). Home region is permanent; "out of host capacity" errors on A1 are common (doc suggests retry or PAYG).
- Trial ($300/30 days) ends: A1 above the free cap is disabled then deleted after 30 days.
- Port 25 outbound blocked (irrelevant here).

### IPv6-only caveat (Hetzner, Vultr, Scaleway)
An IPv6-only host is unreachable from IPv4-only phone networks and home ISPs. Fix: put the domain on Cloudflare's proxy (it terminates over IPv4 and talks IPv6 to origin). Cloudflare free-plan terms **[UNVERIFIED]** (not read from a primary page this session). Otherwise pay the IPv4 fee (Hetzner EUR 0.50).

### VPS ops burden
You own OS patching (unattended-upgrades), firewall, Caddy, systemd unit, backup cron, disk full alerts. About 1-2 h setup, 30 min per quarter. No cold start. Exit risk low (Hetzner raised prices ~37% on 2026-06-15, see [price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/); budget for it).

---

## 3. PaaS with volumes or ephemeral disk

| Platform | Smallest viable cost | SQLite file persists? | Sleep / cold start | Source |
|---|---|---|---|---|
| **Fly.io** | shared-cpu-1x 256 MB **USD 2.19/30 days** (iad/ewr; other regions more) + volume USD 0.15/GB (1 GB = 0.15) + shared IPv4 free + first 10 snapshot-GB free = **~USD 2.35** | **Yes**, volume is a local NVMe slice, one machine only | None unless you enable auto-stop (then ~seconds start, compute not billed while stopped; volume still billed) | [pricing](https://docs.fly.io/about/pricing), [volumes](https://docs.fly.io/volumes/overview) |
| **Railway** | Hobby USD 5/mo including USD 5 usage; RAM USD 10/GB-mo, CPU USD 20/vCPU-mo, volume USD 0.15/GB; Free plan USD 1 credit/mo, 0.5 GB volume | Yes (volume) | None (always on) | [plans](https://docs.railway.com/reference/pricing/plans) |
| **Render** | Free: no disk, spins down after 15 min, ~1 min wake, 750 h/mo. Disks need a paid service; paid instance and disk prices did not render on [pricing](https://render.com/pricing) **[UNVERIFIED]** | Free: **ephemeral**. Paid with disk: yes, but no zero-downtime deploys | Free sleeps | [free](https://render.com/docs/free), [disks](https://render.com/docs/disks) |
| **Koyeb** | No general free tier on the pricing page; Pro USD 29/mo (incl. USD 10 compute); volumes are a Pro feature | n/a | Scale-to-zero exists | [pricing](https://www.koyeb.com/pricing) |
| **Northflank** | Sandbox "starts at $0/mo", always-on, 2 free services; paid compute nf-compute-10 (0.1 vCPU, 256 MB) USD 2.70/mo; disk USD 0.15/GB | Disk exists; whether free tier allows a volume **[UNVERIFIED]** | None | [pricing](https://northflank.com/pricing) |
| **Google Cloud Run** | Free tier (request-based): 180k vCPU-s, 360k GiB-s, 2M requests/mo; USD 0.000024/vCPU-s beyond. Likely **USD 0** for this app | **No**: container FS is ephemeral. GCS FUSE mount "does not provide concurrency control ... (file locking)", last write wins, not POSIX; unusable for live SQLite | Scale-to-zero cold start (Go: sub-second; plus Litestream restore) | search digest of [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing) (direct fetch truncated), [GCS volume docs](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts) |
| **Azure Container Apps** (Consumption) | Free per subscription: 180k vCPU-s, 360k GiB-s, 2M requests/mo; scale-to-zero = no charge; request meter EUR 0.4928/M after free; vCPU/memory per-second rates round to 0.0000 in the API | **Ephemeral** (1 GiB at <=0.25 vCPU). Azure Files mount works but SMB/NFS is wrong for SQLite WAL (see below) | Scale-to-zero cold start | [pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/), [Retail API](https://prices.azure.com/api/retail/prices?currencyCode=EUR&$filter=armRegionName%20eq%20'westeurope'%20and%20serviceName%20eq%20'Azure%20Container%20Apps'), [storage mounts](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts) |
| **Azure App Service** F1 (Free) | EUR 0, 60 CPU min/day, 1 GB RAM, 1 GB storage, no SLA; free/shared plans: no custom-domain SSL (`*.azurewebsites.net` TLS only) | `/home` is network storage; SQLite locking unreliable | Idles, daily CPU quota can stop it | [App Service Linux pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/), [Retail API](https://prices.azure.com/api/retail/prices?currencyCode=EUR&$filter=armRegionName%20eq%20'westeurope'%20and%20serviceName%20eq%20'Azure%20App%20Service') |
| **Azure App Service** B1 | EUR 0.0158/h = **11.53/mo**, 1.75 GB RAM, 10 GB storage; managed cert free (preview, no naked domains) | Same `/home` problem | Always on | same |
| **Azure Container Instances** | Min 1 vCPU / 1 GB; per-second billing; rates did not render; always-on 1 vCPU/1 GB is clearly more than a B-series VM **[UNVERIFIED rates]** | Ephemeral unless Azure Files | none | [ACI pricing](https://azure.microsoft.com/en-us/pricing/details/container-instances/) |

### Azure and SQLite: the locking problem
- App Service Linux `/home` is a network (CIFS) share. Microsoft Q&A and EF Core maintainers report `database is locked` / SQLITE_BUSY, including on `PRAGMA journal_mode=wal`; Microsoft guidance is that storage mounts are not recommended for SQLite. Secondary sources only: [Q&A thread](https://learn.microsoft.com/en-us/answers/questions/318948/azure-app-service-nodejs-sqlite3-lock-issue-cifs-m), [EF Core issue](https://github.com/dotnet/efcore/issues/19536), [DEV write-up on Azure Files SMB](https://dev.to/argha_dev/sqlite-on-azure-files-smb-a-debugging-story-with-a-humbling-ending-1p93). Treat as strong warnings, not an official statement. App Service "local cache" is write-but-discard, so does not help ([doc](https://learn.microsoft.com/en-us/azure/app-service/overview-local-cache)).
- Container Apps Azure Files (SMB or NFS) likewise gives you a network FS; Container Apps NFS needs a custom VNet ([doc](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts)).
- Sane Azure SQLite pattern: **local disk + Litestream to Blob** (VM disk, or ephemeral container FS with restore on start).

### Azure free account, DB and backup options
- Free account: USD 200 credit for 30 days; then 12 months of 750 h each of **B1s, B2pts v2, B2ats v2** VMs (Linux or Windows), plus PostgreSQL Flexible B1MS 750 h with 32 GB storage and 32 GB backup ([free account](https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account)). The page does not list a free managed disk or public IP, so expect about EUR 5.5/mo (E4 disk + IPv4, my arithmetic from the Retail API) for the VM option in year one, EUR 11.7 after. New customers only; one per person.
- Always-free: Container Apps grant above; App Service "up to 10 web/API apps with 1 GB storage"; Cosmos DB 1,000 RU/s + 25 GB (same page); Static Web Apps 100 GB.
- **Azure SQL Database free offer**: 100,000 vCore-seconds and 32 GB data/backup per DB per month, for the lifetime of the subscription, 10 DBs/subscription; at limit either auto-pause until next month or bill at serverless rates; serverless auto-pause means cold-resume latency ([doc, updated 2026-03](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer?view=azuresql)). Free, but needs a **T-SQL rewrite** of all SQL and the 6 migrations.
- **PostgreSQL Flexible B1ms** is only free for 12 months; paid price did not return from the Retail API query **[UNVERIFIED]**.
- **Cosmos DB free tier**: NoSQL/RU model, full data-layer rewrite, not sensible.
- **Blob for Litestream backups**: Hot LRS EUR 0.0172/GB-month, Cool 0.0088 ([Retail API](https://prices.azure.com/api/retail/prices?currencyCode=EUR&$filter=armRegionName%20eq%20'westeurope'%20and%20serviceName%20eq%20'Storage')). 1 GB of replicas about EUR 0.02/mo plus operations (negligible but non-zero).
- **TLS/domain**: Container Apps and App Service give free `*.azurecontainerapps.io` / `*.azurewebsites.net` HTTPS. App Service Domain is USD 11.99/yr; App Service Standard certificate USD 69.99/yr but the managed cert is free (preview) ([pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)). Container Apps managed-cert cost **[UNVERIFIED]** (page truncated).

---

## 4. DB swaps and managed SQLite-ish services

| Option | Cost | Code impact | Verdict |
|---|---|---|---|
| **Turso (libSQL)** | Free: 100 DBs, 5 GB, 500 M rows read, 10 M rows written/mo; Developer USD 4.99/mo (9 GB). No sleep policy stated ([pricing](https://turso.tech/pricing)) | Same SQLite dialect, so SQL and migrations mostly unchanged; driver swap from `modernc` to a libSQL client (cgo `go-libsql` or HTTP/WebSocket client, **[UNVERIFIED]** which fit your build), network latency per query, the single-connection assumption changes. Moderate. | Pairs with free ephemeral compute (Cloud Run / Container Apps), removing the need for Litestream. Does **not** remove the host cost on its own. Vendor-lock and free-tier vanish risk. |
| **Cloudflare D1 + Workers** | Free: 5 M rows read/day, 100 k rows written/day, 5 GB; hitting a cap makes queries error until 00:00 UTC ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)) | **Full rewrite**: Workers runtime (JS/TS or Go-to-WASM), D1 binding API instead of `database/sql`, no embedded-exe model, break of ADR 0002. | Cheapest possible runtime, but rewrite cost far exceeds a year of VPS fees. Reject. |
| **Neon Postgres** | Free: 1 GB/project, 100 CU-hours, compute suspends after 5 min idle (cannot disable); launch is pay-as-you-go USD 0.106/CU-h, USD 0.35/GB-mo ([pricing](https://neon.com/pricing)) | Moderate to high: new driver (`pgx`), `?` to `$n` placeholders, `AUTOINCREMENT` to identity, rewrite SQLite PRAGMA-based migration, test harness uses in-memory SQLite (`internal/test`). | Not worth it for cost. Cold resume adds latency. |
| **Supabase** | Free: 500 MB, 2 active projects, **paused after 1 week inactivity**; Pro USD 25/mo ([pricing](https://supabase.com/pricing)) | Same as Postgres | Reject: auto-pause hits a rarely-used cellar app. |
| **Render free Postgres** | Expires after 30 days, deleted after 14-day grace, no backups ([free](https://render.com/docs/free)) | Postgres | Reject. |

---

## 5. Backups (the "safe for real data" part)

| Method | Cost | Notes |
|---|---|---|
| **Litestream** to object storage | software free; storage below | Continuous WAL streaming, RPO of seconds; external process, no code change; v0.5.x is current ([litestream.io](https://litestream.io/)). Your DB already uses WAL. Run as `litestream replicate -exec ./cellar`; restore at start if `DB_PATH` is empty. Backend list, single-writer rule and static-binary build **[UNVERIFIED]** from the home page (read the guides before adopting). |
| **Cloudflare R2** target | Free 10 GB-month, 1 M Class A ops, 10 M Class B; then USD 0.015/GB-mo; egress free ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)) | Effectively USD 0. Needs a Cloudflare account. Watch Class A ops from Litestream snapshots/segments (still far under 1 M for this app). |
| **Backblaze B2** target | First 10 GB free, then USD 6.95/TB-mo; Class A/B/C calls free; downloads free up to 3x stored ([B2 pricing](https://www.backblaze.com/cloud-storage/pricing)) | Effectively USD 0. |
| **Azure Blob** target | EUR 0.0172/GB-mo Hot | About EUR 0.02. Fine if you are already on Azure. |
| `VACUUM INTO 'x.db'` + cron + rclone/`az storage blob upload` | free | Consistent snapshot while app runs (single connection, WAL). RPO = cron interval (daily is enough for a wine log). Simplest; test restore once. |
| Provider snapshots | Fly: snapshots USD 0.08/GB-mo, 10 GB free, daily, default 5-day retention, **may miss newest writes, docs say do not rely on them as sole backup** ([volumes](https://docs.fly.io/volumes/overview)); Render disk: daily, 7 days, **restore of a live DB may corrupt** ([disks](https://render.com/docs/disks)); DO backups +20%; Hetzner backups (7 slots, percentage not shown) | Use as a second layer only. |

A Fly volume "is not network storage", is on one physical server and is not replicated ([volumes](https://docs.fly.io/volumes/overview)), so **off-host backup is mandatory there**.

---

## 6. TLS, domain, proxy

- **Platform names are free and give real HTTPS**: `*.fly.dev` (first 10 single-hostname certs free, [pricing](https://docs.fly.io/about/pricing)), `*.run.app`, `*.azurecontainerapps.io`, `*.azurewebsites.net`. Enough for service workers and PWA install. Downsides: you cannot move host without changing origin, which means a new IndexedDB (see the origin warning in `service-workers-on-lan.md` section 10; drain the outbox first).
- **Caddy on a VPS**: automatic HTTPS from Let's Encrypt / ZeroSSL with ports 80 and 443 open, renewals automatic, free software ([Caddy docs](https://caddyserver.com/docs/automatic-https)). Needs a DNS name pointing at the host.
- **Domain**: Cloudflare Registrar sells at wholesale cost with no markup ([registrar](https://www.cloudflare.com/products/registrar/)); example `.com` price not on that page **[UNVERIFIED]** (expect roughly USD 10/yr). Azure App Service Domain USD 11.99/yr. A domain is optional on Fly/Cloud Run/Azure, mandatory on a VPS unless you rely on a third-party wildcard-DNS service **[UNVERIFIED]**.
- **Cloudflare free proxy**: hides origin IP, supplies IPv4 front for an IPv6-only origin, can add Access auth; plan terms **[UNVERIFIED]** this session.

---

## 7. Ranked comparison (cheapest first, smallest viable size, with backups)

| # | Option | Monthly | SQLite persistence | Sleep | Setup | Ops | Exit / gotchas |
|---|---|---|---|---|---|---|---|
| 1 | Cloud Run + Litestream to R2/B2 (or + Turso) | ~USD 0 (inside free grant) | ephemeral; restore on each cold start | scale-to-zero cold start | High: Dockerfile, Litestream, GCP billing acct | Low | Free-grant changes; data loss window if killed before Litestream flush; no auth built in; also single-instance must be forced (max 1) |
| 2 | Azure Container Apps + Litestream to Blob | ~EUR 0.02 (Blob) | ephemeral; restore on start | scale-to-zero cold start | High | Low | Per-second vCPU rates not visible in API output; same Litestream window |
| 3 | Oracle Always Free (A1 or Micro) + Caddy + Litestream | EUR 0 | local disk | none | Medium-high (signup, capacity retries) | You patch | **Idle reclamation risk**, home region fixed, account termination stories; keep off-site backup |
| 4 | Northflank Sandbox (free) | USD 0 (volume on free **[UNVERIFIED]**) | volume if allowed | none | Medium | Low | Free tier terms must be confirmed in the console |
| 5 | Scaleway STARDUST1-S + IPv4 | ~EUR 4 (0.43 + ~3.65) | local | none | Medium | You patch | Stardust stock by zone unverified; IPv6-only EUR 0.43 needs CF proxy |
| 6 | **Fly.io 256 MB + 1 GB vol + Litestream to R2** | **~USD 2.4** | volume (single host) | none (or auto-stop) | Medium: Dockerfile + fly.toml (internal_port 8080 matches hard-coded port) | Low (image rebuilds only) | Card required; no free tier; price differs per region; volume = single host |
| 7 | Vultr IPv6-only / IPv4 | USD 2.50 / 3.50 | local | none | Medium | You patch | Sandbox plan wording, 0.5 GB RAM; fetch blocked, confirm on site |
| 8 | DigitalOcean 512 MB | USD 4 (+0.80 backups) | local | none | Medium | You patch | Cheapest big-name VPS with IPv4 |
| 9 | Hetzner CX23 IPv6-only / +IPv4 | EUR 5.49 / 5.99 | local | none | Medium | You patch | **Listed unavailable now**; +37% hike in June 2026; EU data location |
| 10 | Railway Hobby | USD 5 | volume (5 GB cap) | none | Low | Low | Usage-based; Free plan USD 1 credit is not enough for always-on |
| 11 | Hetzner CAX11 | EUR 5.99 | local | none | Medium | You patch | Unavailable now; ARM |
| 12 | Contabo VPS 4 (24-mo) / OVH VPS-1 | EUR 5.50 / USD 4.54 | local | none | Medium | You patch | Long-term commitments, overspec |
| 13 | Azure B2pts v2 VM + Caddy (12-mo free VM hours, then paid) | ~EUR 5.5 yr 1, ~EUR 11.7 after | local disk | none | Medium | You patch | New-customer-only free year |
| 14 | Azure App Service B1 | EUR 11.53 | `/home` is network FS, **SQLite unreliable** | none | Low | Low | Would need external DB. Reject |
| - | Azure SQL free offer, Neon, Supabase, D1, Cosmos | EUR 0 | n/a | pause/resume | **Rewrite** | Low | Reject for cost-of-change |

Free tiers that sleep or expire (Render free, Supabase, Neon) are excluded from the ranking for real user data.

---

## 8. Recommendation (lowest total cost still safe for real data)

1. **Fly.io, one 256 MB machine + 1 GB volume + Litestream to R2 (or B2), `*.fly.dev` name: about USD 2.4/month** (about EUR 2.2 plus VAT if charged). This is the cheapest option where the SQLite file lives on a real local volume with no cold-start restore ritual, plus continuous off-host backup for about zero. Smallest code work: a Dockerfile (static `CGO_ENABLED=0` Linux build), `fly.toml` with `internal_port = 8080` and `DB_PATH=/data/cellar.db`, a `litestream.yml`, and a Linux CI job. Optionally set a monthly `VACUUM INTO` copy as a second backup.
2. **If a hard EUR 0 matters more than convenience**: Oracle Always Free (accept reclaim risk, Litestream makes recovery a 10-minute job) or Cloud Run/Azure Container Apps with Litestream (accept cold-start restore, force max 1 instance). These win only by about USD 2/month, so pick them for principle, not savings.
3. **If you want a VPS you own**: Hetzner CAX11/CX23 once available again (EUR 5.49-5.99, IPv6-only, + Cloudflare proxy or EUR 0.50 for IPv4) with Caddy + Litestream. Vultr (USD 2.50-3.50) and DO (USD 4) are cheaper but weaker on RAM/IPv4.
4. **Do not** swap the DB engine to save money. The only free engines worth it (Turso) do not remove the host cost, and Postgres/D1/Azure SQL need real rewrites. Azure is only competitive with scale-to-zero containers, not VMs or App Service.
5. **Before going public, whatever the host**: add authentication (or Cloudflare Access / Caddy basic auth), a health-check URL for the platform (`internal/handlers/health_test.go` suggests one exists; path not checked), pin to one instance, and plan the origin change (new IndexedDB origin, drain the outbox first).

---

## 9. Open questions

- Is a domain acceptable (about USD 10/yr)? Do you want the app on a name you control to avoid a second origin change later?
- Who is allowed in? Basic auth, a shared secret, or a proper login? Is the Windows PC deployment staying alongside (then ADR 0002 and CI need a second target)?
- Is EU data residency or a EUR-only invoice needed (Hetzner/OVH/Scaleway vs Fly/Vultr)? Fly's cheapest prices are in iad/ewr; a `cdg`/`ams` machine costs more (not read).
- Is a credit card on file with Fly, Oracle or GCP/Azure acceptable? (Fly has no free tier; Oracle and Azure free accounts need a card.)
- Appetite for ops: Litestream restore-on-boot and a second backup copy, versus a PaaS-snapshot-only comfort level?
- Was the Hetzner "currently unavailable" status a stock outage or permanent? Check the console in the target location.
- Unconfirmed items to verify before committing: Render paid instance and disk prices, Northflank free volumes, Cloudflare free proxy and Access terms, Cloud Run pricing page directly, Azure Container Apps per-second vCPU/memory rates, Azure PostgreSQL B1ms paid price, Oracle PAYG vs reclaim, Vultr page directly, Scaleway Stardust stock.
