# 02: Scan label — capture, prefill, and unresolved-field feedback

**What to build:** A "Scan label" action on the Add Wine form (create path only, not edit) that lets the cellar owner supply a photo of the bottle's etiquette — camera on mobile, file picker on desktop — runs it client-side through the OCR wrapper and ticket 01's `labelScan.ts` parser, and prefills Millesime, Producer, Color, and Appellation. The form is disabled with a loading indicator while a scan is in flight. Every prefilled field stays editable, and nothing is ever submitted automatically — the owner still presses "Add wine" themselves. Fields the scan couldn't confidently read or match are surfaced in a non-blocking note, including the raw scanned text when the Appellation didn't match. Scanning again overwrites all four fields from the new result, whether or not the owner had edited them since the last scan. The photo itself is never stored or uploaded — it only exists in memory for the duration of the scan.

**Blocked by:** 01 (OCR asset pipeline & label-parsing module)

**Status:** ready-for-agent

- [ ] "Scan label" control appears on the Add Wine form only, not on the edit-Wine form
- [ ] On mobile, the control opens the camera; on desktop, it opens a file picker
- [ ] While a scan is processing, the form is disabled and a loading indicator is shown
- [ ] A successful scan populates Millesime, Producer, Color, and Appellation (via ticket 01's matching), all still editable afterward
- [ ] Garde start/end and Quantity are never touched by a scan
- [ ] Fields the scan couldn't read or confidently match are listed in a non-blocking note; an unmatched Appellation's note includes the raw scanned text
- [ ] Scanning a second time overwrites all four scan-populated fields with the new result, even if the owner had edited them after the first scan
- [ ] Completing a scan never submits the form; adding the Wine still requires the owner to press "Add wine"
- [ ] The scanned photo is not stored or attached to the created Wine
- [ ] Component tests mock the OCR-engine wrapper (no real `tesseract.js`/WASM in tests) and cover: successful scan populating fields, unresolved-field note (incl. raw appellation text), rescan overwrite, and absence of the control on the edit route
