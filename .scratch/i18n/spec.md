# Wine Cellar — English and French UI (i18n/l10n)

Status: ready-for-agent

## Problem Statement

The cellar owner and the EU users now testing the app use it in both English and French, but every screen is hard-coded English: labels, buttons, toasts, confirm dialogs, validation messages, the error copy mapped from backend codes, and the document title. Wine vocabulary is a mix of French terms (Millesime, Garde, rouge/blanc/rose) and English sentences, so an English speaker has to know French wine jargon to read their own cellar, and a French speaker reads a half-English app. Consumption dates show as raw ISO text (`2026-03-12`). The page language is hard-coded to English, so assistive tech and browser translation get the wrong signal. The Storage Consent page planned in ADR 0010 must be understandable in the user's own language, so it cannot ship in English only.

## Solution

The whole UI is available in English and French. The app picks the language from the browser (French for any `fr*` locale, English otherwise), and the user can switch from the Manage hub at any time; the switch applies immediately without a reload. Wine terms use approved display labels per language (`docs/i18n-vocabulary.md`): English shows Vintage, Drinking window, Red/White/Rosé; French shows Millésime, Fenêtre de garde, Rouge/Blanc/Rosé; "Appellation" is the same in both. Dates show in the active language's format, years always show as plain digits, the page language and document title follow the active language, and every error message, including ones for queued offline changes, appears in the current language. User-entered data (wine, producer, meal and appellation names, consumption notes) is never translated. Both languages work offline.

## User Stories

### Choosing and keeping a language

1. As a French-speaking user, I want the app to open in French when my browser is set to French, so that I don't have to find a setting first.
2. As an English-speaking user, I want the app to open in English when my browser is set to anything other than French, so that the default is predictable.
3. As a user, I want to switch language from the Manage hub, so that I can override the browser default.
4. As a user, I want the switch to apply immediately without a reload, so that I see the result and can't lose a half-filled form.
5. As a user, I want the language switcher to show each language by its own name ("English", "Français"), so that I can find mine even when the UI is in the wrong language.
6. As a user, I want the current language clearly indicated in the switcher, so that I know what is active.
7. As a user who refused Storage Consent, I want my language choice kept for the session without being stored on my device, so that the app respects my refusal.
8. As a user who granted Storage Consent, I want my language choice remembered on my device, so that I don't have to re-pick it each visit.
9. As a user on the Storage Consent page (ADR 0010), I want to switch language before choosing, so that I can read the consent text in a language I understand.
10. As a user, I want the browser tab title to be in the active language, so that it matches the page.
11. As a user relying on a screen reader or browser translation, I want the page language attribute to match the active language, so that the content is read and translated correctly.

### Reading the cellar in either language

12. As an English-speaking user, I want to see "Vintage" instead of "Millesime", so that I don't need French wine jargon to read my cellar.
13. As an English-speaking user, I want "Drinking window" with "Start" and "End", so that the garde range reads naturally.
14. As an English-speaking user, I want colors shown as Red, White and Rosé, so that the filter and badges are readable.
15. As a French-speaking user, I want Millésime, Fenêtre de garde, Début and Fin with correct accents, so that the vocabulary matches how I speak about wine.
16. As a French-speaking user, I want colors shown as Rouge, Blanc and Rosé, so that they read as proper French.
17. As a user, I want Garde Status badges in my language (Too young / Ready / Past peak / Not assessed; Trop jeune / À boire / Passé / Non évalué), so that a glance tells me what to drink.
18. As a French-speaking user, I want "Cave", "Vin", "Producteur", "Plat", "Accord mets-vin", "Quantité" and "Consommation" throughout, so that every screen uses the same approved vocabulary.
19. As an English-speaking user, I want "Appellation" unchanged, so that the one term that is the same in both languages stays recognizable.
20. As a user, I want counts and sentences to use correct singular and plural forms ("1 wine" / "2 wines", "1 vin" / "2 vins"), so that nothing reads like a placeholder.
21. As a French-speaking user, I want a count of zero treated as singular ("0 vin"), so that French plural rules are respected.
22. As a user, I want my wines, producers, meals and appellations shown exactly as I typed them, so that my own data is never altered by a language switch.
23. As a user, I want my consumption notes left untouched, so that my own words stay mine.
24. As a user, I want consumption dates written the way my language writes them ("12 March 2026" / "12 mars 2026"), so that dates are quick to read.
25. As a user, I want years (millesime and garde bounds) always written as plain digits with no separator, so that "2018" never becomes "2,018" or "2 018".
26. As a user, I want the date I type or pick to be submitted and stored as before, so that localization never changes saved data.

### Messages, errors and feedback

27. As a user, I want validation messages on the wine, meal, appellation, producer and consumption forms in my language, so that I understand what to fix.
28. As a user, I want error messages for failed requests in my language, so that I know what happened and what to do next.
29. As a user, I want a failed queued offline change on the sync page explained in my current language, even if it failed before I switched language, so that I'm never reading stale-language text.
30. As a user, I want the offline banner, success toasts, empty states, loading and retry text, and confirm dialogs in my language, so that no English leaks into the French UI or the reverse.
31. As a user, I want field labels, placeholders, button titles and accessible names in my language, so that the app is fully usable with assistive tech.
32. As a user, I want the sync-status page, header indicator and "not yet synced" badges in my language, so that offline features are as clear as online ones.
33. As a user, I want the Storage Consent page text in both languages, so that my consent is informed.
34. As a user, I want the app to work fully offline in either language, so that going offline never drops me back to English or to missing text.
35. As a user, I want a missing translation to show the English text rather than a raw key, so that a gap is a small blemish, never a broken screen.

### Maintaining the translations

36. As the developer, I want a test that fails when a key exists in one language and not the other, so that a half-translated feature can't ship.
37. As the developer, I want new screens to use translation keys from the start, so that no new hard-coded text accumulates.
38. As the developer, I want the existing test suite to keep asserting the same English text, so that extraction is provably behavior-preserving.
39. As the developer, I want a small French smoke test per area, so that a broken French dictionary or locale switch is caught.
40. As the developer, I want one approved vocabulary document, so that terms don't drift between screens, translators and the glossary.
41. As the developer, I want a new backend error code to need exactly one new key per language, so that adding an error is a small, checkable change.

## Implementation Decisions

- **Library and bundling (ADR 0011).** `vue-i18n` with two dictionaries (English, French) bundled into the main build and precached by the existing service worker, so localization works offline. The English dictionary is the fallback for missing keys. The app's active locale is a reactive value the whole UI follows.
- **Locale resolution.** Default from the browser's preferred language: French when it starts with `fr`, English otherwise. A user override takes precedence. Persistence is behind a small "locale preference" module: it stores the override only while Storage Consent is granted (ADR 0010) and otherwise holds it in memory for the session. Until Storage Consent ships, that module always uses memory-only behavior; the persistence branch lands with the consent work.
- **Switcher.** A language control in the Manage hub listing the two languages by their own names, with the active one marked. The Storage Consent page (a separate effort) will embed the same control; it must be built as a reusable component, not inlined in the hub.
- **Document-level effects.** The page language attribute and the document title are set from the active locale and update on switch. The static PWA manifest is not localized.
- **Key conventions.** Nested, semantic keys grouped by area (for example `cellar.list.title`, `sync.retry`, `errors.invalid_color`); the English sentence is never used as the key. Interpolation uses named placeholders. Plurals use the library's plural syntax, with French treating zero as singular. Each area's strings live in their own dictionary module per language and are merged into one catalog per language.
- **Vocabulary.** Display labels follow `docs/i18n-vocabulary.md` exactly. These are UI labels, not domain terms: `CONTEXT.md` keeps the canonical French terms for code and discussion, and stored values (`rouge`, `blanc`, `rose`, Garde Status codes) and API payloads never change. Display labels for Color and Garde Status are looked up from the stored value.
- **Error and validation messages.** Pure domain functions that currently return English strings (form validation, client-side network message) return a message key plus parameters instead; the view translates them. Backend error codes map to `errors.<code>` keys. The outbox stores only the code, so a failed queued item's reason is translated at display time and follows later language switches. A code with no key falls back to the generic message in the active language.
- **Formats.** Consumption dates display via the platform's locale-aware date formatting in the active language; the stored and transmitted value stays `YYYY-MM-DD`. Years render with no digit grouping in both languages. The native date input keeps following the browser's locale, not the app's; this is accepted.
- **Scope of translation.** All user-visible text: views, components, toasts, dialogs, empty/loading/error states, placeholders, titles, accessible names, the sync-status surfaces, validation and error messages. Not translated: user data, the manifest name, and server error codes.
- **Rollout.** One foundation change first (library, catalog structure, locale resolution and preference module, switcher component and hub entry, document language/title, date and number formatting helpers, parity test, test setup) with no extraction of existing text. New or changed UI text from other efforts (including the real-world-feedback tickets, the data gateway, pagination and the consent page) uses keys from day one. Existing text is then extracted area by area: application shell (header, banner, toast, dialogs, shared components), cellar list and filters, wine detail and form, management pages (meals, appellations, producers, meal pairings), sync-status page and badges, error and validation messages. Each slice is independently shippable and leaves the app fully working in both languages for the areas already converted.
- **No API changes.** The server stays locale-free; no endpoint, schema or `api.http` change.
- **ADR.** ADR 0011 records the library, the locale-persistence rule and the UI-labels-are-not-domain-terms rule; this spec follows it.

## Testing Decisions

- **What a good test is here.** Mount a real view (or component) at the highest seam, with the locale set, and assert the visible text and behavior a user would see. Never assert on catalog internals, key names, or which function produced a string.
- **Highest seam (existing, reused).** Mounted-view tests with a memory router, the mocked API client and the fake IndexedDB, exactly as the cellar list and detail view tests do today. These already cover rendering, filters, forms and messages end to end.
- **One new shared seam.** A global test setup that installs the i18n plugin with the locale pinned to English. Every existing mounted test then passes unchanged and keeps asserting the same English text, which is the safety net for each extraction slice. Tests that need French set the locale explicitly through the same seam.
- **Per-area French smoke tests.** For each slice, one test mounts the key view in French and asserts a few strings, including a Garde Status label, a color label and a pluralized count. Also test: switching language updates a mounted view in place without a reload; user data is unchanged after a switch; a missing French key falls back to English; zero is singular in French.
- **Parity test.** One test walks both catalogs and fails if any key exists in only one language, or if any placeholder name differs between the two versions of a message.
- **Pure-unit tests.** Locale resolution from browser language lists (including `fr-CA`, `fr-FR`, `en-US`, an unsupported language, and an empty list); the preference module's memory-only and persisted behavior; date and year formatting in both languages; the validation functions returning key plus parameters.
- **Error path.** A failed queued item stored before a language switch renders in the new language; a backend error code with no key shows the generic message.
- **Prior art.** The cellar list, wine detail and form view tests (mount with memory router, mocked client, fake IndexedDB reset between tests), the sync-status view tests, the existing error-message unit tests, and the domain unit tests for form validation and Garde Status.

## Out of Scope

- Languages beyond English and French; the switcher is a list of two and nothing more is designed.
- Translating user-entered data, or any machine translation of it.
- Localizing the PWA manifest (static, brand name) or the install prompt text owned by the browser.
- A custom date picker; the native input's locale mismatch is accepted.
- Locale-aware or accent-insensitive sorting of lists (binary ordering stays, ADR decision on referential list sorting).
- Right-to-left layout.
- Server-side localization, `Accept-Language` handling, or any API change.
- The Storage Consent page itself and the persistence branch of the locale preference, which belong to the storage-consent effort (ADR 0010).
- Currency, unit or time-zone handling: the app has none.

## Further Notes

- **Sequencing.** This foundation comes first so the real-world-feedback tickets, the storage-consent effort and the offline wine list and pagination all write their new text with keys from the start. Extraction of existing text follows area by area.
- **Dependency on ADR 0010.** Persisting the language choice depends on Storage Consent existing. Until then a user's choice lasts for the session and the browser language applies on the next visit, which is the correct behavior for a user who has not consented.
- **Vocabulary decisions already made** (see `docs/i18n-vocabulary.md`): "Consommation" for Consumption in French, "Passé" for past peak, "Fenêtre de garde" for the Garde window, English "Vintage" and "Drinking window". The glossary's "avoid" guidance (Vintage, Peak year) applies to code and discussion, not to localized UI labels.
- **Review of French.** French strings are drafted by the agent, reviewed by the owner in the PR, and guarded by the parity test and English fallback.
- **Related decisions.** ADR 0006 (offline-first sync: stored error codes), ADR 0010 (Storage Consent, consent page), ADR 0011 (i18n decisions).
