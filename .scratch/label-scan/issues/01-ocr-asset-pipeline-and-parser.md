# 01: OCR asset pipeline & label-parsing module

**What to build:** The offline-capable foundation for Label Scan (per ADR-0004): `tesseract.js` added as a frontend dependency with its wasm core and French (`fra`) traineddata self-hosted (copied from `node_modules` into the built static assets, used identically in dev and production build, gitignored as generated artifacts) rather than fetched from `tesseract.js`'s default CDN. Alongside it, a pure `labelScan.ts` module that turns raw OCR text plus the current Appellation list into matched Wine fields (Millesime, Producer, Color, Appellation) and a list of fields that weren't confidently read or matched. No UI in this ticket — verified entirely through tests.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `tesseract.js` installed via the package manager; its wasm core and `fra` traineddata are copied from `node_modules` into the app's built static assets at both dev-server startup and production build (no runtime CDN fetch)
- [ ] The copied/generated asset files are gitignored, not committed
- [ ] `labelScan.ts` exports a pure function taking raw OCR text + the Appellation list, returning matched fields (millesime, producer, color, appellationId) plus a list of unresolved field names
- [ ] A scanned appellation that closely matches an existing Appellation is auto-matched; one with no confident match is left unmatched (never auto-created), with the raw scanned appellation text available for the unresolved-field detail
- [ ] Raw text with no vintage year present (e.g. non-vintage/NV wording) resolves Millesime to unset rather than a guessed value
- [ ] Unit tests cover: clean full match, no-vintage/NV text, close-but-inexact appellation match, no-plausible-appellation-match, Color word present/absent
