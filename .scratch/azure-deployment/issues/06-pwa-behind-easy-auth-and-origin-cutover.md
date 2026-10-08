# 06: PWA behind Easy Auth and origin cutover

**What to build:** make sure the service worker, manifest and install flow work behind Easy Auth, and move existing phones from the LAN origin to the new one without losing outbox data.

**Blocked by:** 05

**Status:** code and docs done; manual items need a real Azure deploy + Android phone (see docs/azure-deployment.md > PWA behind Easy Auth)

- [x] (config; verify live) `manifest.webmanifest` and the service worker script load without an auth redirect (excluded paths or verified after login)
- [ ] SW registers, app installs (WebAPK) and cold-starts offline on Android Chrome
- [ ] Gated update (offline-first-pwa/08) verified on the real origin
- [x] (code + test; verify live) Expired session while offline does not lose outbox items; sync resumes after re-login
- [x] Cutover note: drain each phone's outbox on the old LAN origin first (new origin = fresh IndexedDB); existing DB copied up and restored/seeded in Azure
