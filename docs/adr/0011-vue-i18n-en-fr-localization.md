---
status: accepted
---

# Localize the UI in English and French with vue-i18n, client-side only

The app is used in English and French, so all user-visible text goes through `vue-i18n` with two bundled dictionaries (EN, FR), precached by the service worker so the app localizes offline. The server stays locale-free: it already returns error codes only, and the client maps codes to text at display time, so a stored outbox error re-renders in the current language. The locale defaults from the browser language, can be switched from the header toggle on every page (and the consent page), and is persisted only while Storage Consent is granted (ADR 0010); otherwise it lives in memory for the session.

UI labels are display text, not domain terms: `CONTEXT.md` keeps the canonical French terms (Millesime, Garde, rouge/blanc/rose) for code and discussion, and stored values never change. The English UI shows translated labels (Vintage, Drinking window, Red/White/Rosé; "Appellation" unchanged); the French UI shows the accented forms.

## Considered Options

- **Hand-rolled typed dictionary plus `Intl`** — rejected: re-implements interpolation and French/English plural rules for no real saving.
- **Keep the French wine terms in the English UI** — rejected: English-speaking users shouldn't need the jargon to read their own cellar.
- **Server-side localization (Accept-Language)** — rejected: the server sends codes, not prose, so there is nothing to translate there.

## Consequences

- User data (wine, producer, meal, appellation names, consumption notes) and the static PWA manifest are not translated.
- `<html lang>` and the document title follow the active locale. Dates display localized; stored and sent values stay `YYYY-MM-DD`. Years render as plain digits. The native date input follows the browser locale, not the app's.
- A parity test requires every EN key to exist in FR and vice versa; a missing key falls back to English.
- Existing tests run under a fixed English locale so they keep asserting the same text.

_Amended 2026-10-16: language switching moved from the Manage hub to a plain `FR | EN` toggle in the header. See `.scratch/utilities-ux/spec.md`._
