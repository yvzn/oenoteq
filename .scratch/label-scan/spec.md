# Label Scan

Status: ready-for-agent

## Problem Statement

Adding a Wine means typing Millesime, Appellation, and Producer by hand off the bottle's etiquette every time — tedious, and error-prone for long producer names or unfamiliar appellations, especially doing it on a phone at the moment of unpacking a case.

## Solution

On the Add Wine form, a "Scan label" action lets the cellar owner supply a photo of the bottle's etiquette (camera on mobile, file picker on desktop). The photo is run through client-side OCR (no photo ever leaves the device) and the result prefills Millesime, Appellation, Producer, and Color. The owner still reviews and can correct every field before an explicit, manual "Add wine" submit — scanning never adds a Wine by itself. Garde and Quantity are never touched by a scan: they're the owner's own judgment/stock count, not printed on any label.

## User Stories

### Capture

1. As a cellar owner, I want a "Scan label" action on the Add Wine form, so that I can prefill the form from a photo instead of typing everything.
2. As a cellar owner using my phone, I want "Scan label" to open my camera directly, so that I can photograph the bottle on the spot.
3. As a cellar owner at my desktop, I want "Scan label" to open a file picker, so that I can use an existing photo of the label.
4. As a cellar owner, I want Scan label available only on the Add Wine form (not when editing an existing Wine), so that the feature stays scoped to the case it was built for.

### Extraction

5. As a cellar owner, I want a scan to prefill Millesime, Appellation, Producer, and Color, so that I don't retype what's printed on the label.
6. As a cellar owner, I want Garde start/end and Quantity left untouched by a scan, so that fields that aren't on any label always stay under my own control.
7. As a cellar owner, I want the scan to run entirely on my device, so that photos of my wine labels are never sent to a third party.
8. As a cellar owner with a non-vintage wine (e.g. Champagne NV), I want a scan that finds no vintage year to leave Millesime blank rather than guess, consistent with Millesime already being optional.

### Appellation matching

9. As a cellar owner, I want a scanned appellation that closely matches one already in my Appellation list to be auto-selected, so that I don't have to pick it manually when the read is clean.
10. As a cellar owner, I want a scanned appellation that doesn't confidently match anything in my list to be left unselected rather than force a wrong pick, so that bad matches don't silently corrupt my data.
11. As a cellar owner, I want a scan to never create a new Appellation on its own, so that my Appellation list only grows through my own explicit "create new appellation" action.

### Review and feedback

12. As a cellar owner, I want the form disabled with a loading indicator while a scan is processing, so that I don't edit fields that are about to be overwritten by the scan result.
13. As a cellar owner, I want to be told which fields the scan couldn't read or match, so that I know exactly what to fill in or fix myself.
14. As a cellar owner, I want the unmatched-appellation note to show me the raw text the scan read, so that I can tell whether it's a typo, an appellation I haven't created yet, or a bad photo.
15. As a cellar owner, I want every field to remain editable after a scan fills it in, so that I can fix anything the scan got wrong before submitting.
16. As a cellar owner, I want scanning to never submit the form by itself, so that a bad or partial read can never add a wrong Wine to my cellar without my say-so.

### Rescanning

17. As a cellar owner unhappy with a scan's result, I want to scan again with a different photo, so that I can get a better read without starting the form over.
18. As a cellar owner, I want a rescan to overwrite Millesime, Appellation, Producer, and Color with the new result (not merge with what I'd already typed), so that "scan" always means "start these fields fresh from this photo."

## Implementation Decisions

- **OCR engine**: `tesseract.js`, run client-side in the browser (WASM), per **ADR-0004**. No server-side OCR, no cloud vision API — the photo is processed and discarded entirely in-browser.
- **Language**: French traineddata only (`fra`). No English or multi-language pack for v1.
- **Asset delivery**: `tesseract.js` is a normal npm dependency, but its wasm core and `fra` traineddata are *not* fetched from `tesseract.js`'s default CDN at scan-time — that would require internet access at scan-time, defeating the point of running client-side. Instead, the build copies these files from `node_modules` into the built static assets (used identically in dev and in the production build), and `createWorker` is pointed at the local `corePath`/`langPath`. These copied files are generated artifacts and must be gitignored, not committed.
- **New pure module** `web/src/domain/labelScan.ts`: takes raw OCR text plus the current Appellation list, returns matched `WineFormFields` (subset: millesime, producer, color, appellationId) plus a list of field names that weren't confidently read/matched. Appellation matching uses a fuzzy comparison against the existing list; below the confidence threshold, appellation is left unmatched (not guessed, not auto-created) and the raw scanned text is included in the unresolved-field detail so the UI can display it.
- **New composable/wrapper** around `tesseract.js`'s `createWorker`/`recognize` (e.g. `useLabelScan.ts` or similar), owning the actual OCR call and worker lifecycle; it calls the pure `labelScan.ts` parser on the recognized text and returns matched fields + unresolved field names to `WineFormView`.
- **WineFormView**: gains a "Scan label" control (only in the create/Add Wine path, not edit) wired to a file input using the `capture` attribute so mobile opens the camera and desktop falls back to a file picker. While a scan is in flight, the form is disabled and a loading indicator shown (mirrors the existing `loading`/`StatusLine` pattern already used for appellations/wine loading). On scan completion, `millesime`, `appellationId`, `producer`, and `color` refs are overwritten unconditionally from the scan result (no per-field "already touched by user" tracking). Unresolved fields are surfaced via a non-blocking note (not a blocking error, not the existing `submitError`/`StatusLine` error tone) listing which fields weren't read/matched, including the raw unmatched appellation text when applicable.
- **No new backend endpoint or schema change**: Label Scan is a client-only prefill step ahead of the existing Add Wine submit flow; the Wine creation API contract is unchanged.
- **No image persistence**: the captured photo is held only transiently in memory for the duration of the scan and is not uploaded, stored, or attached to the Wine record.

## Testing Decisions

- A good test here exercises observable behavior — form field values, disabled/loading state, the unresolved-fields note — never internal calls into `tesseract.js` itself.
- **`labelScan.ts` (pure parser)**: unit-tested directly with `vitest`, same pattern as `wineForm.test.ts` — feed it raw OCR text strings and an Appellation list, assert on the returned matched fields and unresolved-field list. Covers: clean match, no vintage found (NV case), appellation close-but-not-exact match, appellation with no plausible match at all (raw text surfaced), Color word present/absent.
- **`WineFormView.test.ts` (component)**: extends the existing pattern of mocking `apiClient` (see current mocks for `/appellations`, `/wines/:id`) by also mocking the OCR-engine wrapper module, so no real `tesseract.js`/WASM runs in tests. Drives: clicking "Scan label" disables the form and shows loading; a resolved scan populates the four fields; an unresolved field produces the note (including raw appellation text); a second scan overwrites all four fields even if the user had edited them after the first scan; the control is absent on the edit-Wine route.
- **Prior art**: `wineForm.test.ts` for the pure-module pattern; `WineFormView.test.ts` for the mocked-boundary component pattern (currently mocks `apiClient`, extended here to also mock the OCR wrapper).

## Out of Scope

- Editing an existing Wine via a scan (Add Wine form only).
- Scanning Garde (start/end) or Quantity — never printed on a label, always manual.
- Storing or attaching the scanned photo to the Wine record.
- Auto-creating a new Appellation from an unmatched scan result (the existing manual "create new appellation" affordance remains the only way).
- English or any non-French traineddata/language support.
- Any server-side or cloud-based OCR path (see ADR-0004 for the rejected alternatives and why).
- Per-field "don't overwrite what I already edited" merge logic on rescan.

## Further Notes

- Domain vocabulary: this feature is **Label Scan** in `CONTEXT.md` — use that term in code/UI copy, not "OCR" or "photo import".
- **ADR-0004** records why Label Scan runs client-side with self-hosted OCR assets rather than a cloud vision API or server-side OCR, and why `tesseract.js`'s default CDN-fetched assets were rejected in favor of self-hosting them.
- This spec resulted from a grilling session with the user covering capture mechanism, OCR engine/architecture, field scope, appellation-matching policy, image retention, failure handling, asset delivery, language, scan-in-progress UX, and rescan semantics — all decisions above trace back to explicit user answers, not assumptions.
