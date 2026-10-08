# 05: Audit and contract

**What to build:** close out the localization so nothing user-visible stays English-only: sweep for leftover hard-coded text, give every area a French smoke test, and confirm the whole app is usable in both languages and offline.

**Blocked by:** 03 (Cellar list and wine detail), 04 (Forms and management)

**Status:** ready-for-agent

- [ ] No remaining hard-coded user-visible text in views, components, domain functions or composables (including `aria-label`, `title`, `placeholder`, toasts and dialogs); stragglers moved to the catalogs in both languages
- [ ] The fallback document title in the static `index.html` is acceptable as the pre-load default and the active locale's title replaces it once the app loads
- [ ] Every area has a French smoke test (shell, sync surfaces, list, detail, forms, management, pairing, hub); parity test green
- [ ] With the network off, the app localizes correctly in both languages (catalogs precached) and a missing French key falls back to English, never a raw key
- [ ] `docs/i18n-vocabulary.md` matches the labels in the catalogs; any divergence is fixed in one of them
- [ ] New UI text added by other efforts since ticket 01 (real-world-feedback tickets, consent, pagination) is also translated
- [ ] No API, schema or `api.http` change
