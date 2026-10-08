# 01: Foundation: switchable language

**What to build:** the localization foundation, demoable on the Manage hub. The app resolves its language from the browser (French for any `fr*` locale, English otherwise), the user can switch between English and French from a language switcher on the Manage hub, and the whole hub page re-renders in the chosen language without a reload. The page language attribute and the browser tab title follow the active language. No other screen's text is extracted yet. See `.scratch/i18n/spec.md` and ADR 0011.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `vue-i18n` installed with an English and a French catalog bundled into the main build (so the service worker precaches both); English is the fallback for a missing key
- [ ] Catalog structure: nested semantic keys grouped by area, one dictionary module per area per language merged into one catalog per language; named placeholders; plural syntax with French treating zero as singular
- [ ] Locale resolution from the browser's preferred languages: `fr`, `fr-FR`, `fr-CA` → French; `en-US`, an unsupported language and an empty list → English; unit-tested
- [ ] A locale preference module: user override beats the browser default; it holds the override in memory only for now (no device storage until Storage Consent exists, ADR 0010), behind an interface so a persisted branch can be added later; unit-tested
- [ ] A reusable language switcher component listing each language by its own name ("English", "Français") with the active one marked; used on the Manage hub (the Storage Consent page will embed it later)
- [ ] The Manage hub page is fully translated, including the switcher's label, using the approved vocabulary in `docs/i18n-vocabulary.md` where applicable
- [ ] Switching language updates the mounted hub in place with no reload
- [ ] `<html lang>` and the document title update with the active locale
- [ ] Locale-aware date formatting helper (stored/sent value stays `YYYY-MM-DD`) and a year helper that never inserts digit grouping in either language; unit-tested in both languages
- [ ] Validation/error helpers can return a message key plus parameters (the pattern later tickets adopt); no existing validator is changed in this ticket
- [ ] A parity test fails when a key exists in only one language or a message's placeholder names differ between languages
- [ ] A global test setup installs the plugin with the locale pinned to English, so all existing mounted-view tests pass unchanged; a missing key during a test fails the test
- [ ] A hub test in French (language switch, a few strings) and user data is never altered by a switch
- [ ] No API, schema or `api.http` change
