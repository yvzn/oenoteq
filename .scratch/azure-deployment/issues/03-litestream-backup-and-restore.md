# 03: Litestream backup and restore to Azure Blob

**What to build:** container entrypoint that restores the SQLite DB from Azure Blob if the local file is absent, then runs the app under `litestream replicate`. Disabled unless configured, so local dev and the Windows exe are unaffected.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] On empty disk, entrypoint restores latest replica; on first ever start with no replica it starts empty
- [ ] While running, WAL changes replicate to Blob within seconds
- [ ] Kill container, start new one: data written before the kill is present (verified manually, ideally with Azurite)
- [ ] Without Litestream env vars the app starts exactly as before
- [ ] Restore procedure and point-in-time recovery steps documented in `docs/`
