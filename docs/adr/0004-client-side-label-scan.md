---
status: accepted
---

# Run Label Scan client-side with self-hosted OCR assets, not a cloud vision API or server-side OCR

Label Scan (OCR-assisted prefill of the Add Wine form from a photo of the bottle's etiquette) runs entirely in the browser via `tesseract.js`/WASM, French-only traineddata. Rejected a cloud vision API (Google/Azure/Claude vision): would need internet access, an API key to manage, and would send the photo to a third party — all at odds with this being a single-user, no-ops, offline-capable app (ADR-0002) that runs on a home-LAN PC not always connected. Rejected server-side OCR (shelling out to a `tesseract` binary from Go): would break the single-exe deployment story by requiring an extra binary/data files alongside the Go exe. `tesseract.js` is installed via npm like any other frontend dependency, but its default config fetches the wasm core and language traineddata from a public CDN at scan-time — that reintroduces the exact internet dependency this ADR rejects, so the core/lang files are copied from `node_modules` into the built static assets at dev and build time (gitignored, regenerated, not committed) and served by the existing static handler instead. Revisit if label scanning needs languages/scripts beyond French, or if OCR accuracy proves too poor client-side and a cloud API becomes worth the trade-off.

## Considered Options

- **Client-side WASM, self-hosted assets (chosen)**: offline-capable, no secrets, no third party sees the photo, consistent with ADR-0002.
- **Cloud vision API**: best accuracy, but needs internet + API key + sends personal photos off-device.
- **Server-side OCR (Go + tesseract binary)**: keeps browser thin, but breaks the single-exe deployment (ADR-0002).
- **`tesseract.js` default CDN-fetched assets**: zero-config, but needs internet at scan-time — same dependency the client-side choice was meant to avoid.
