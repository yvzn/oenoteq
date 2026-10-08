# 02: Shell, sync surfaces and error messages

**What to build:** the app shell and the cross-cutting text work in English and French: header, offline banner, success toast, dialogs, shared components, Garde Status and Color labels, backend error messages, and the sync-status surfaces. A user who switches language sees these everywhere they appear, and a failed queued change explains itself in the current language even if it failed before the switch.

**Blocked by:** 01 (Foundation: switchable language)

**Status:** ready-for-agent

- [ ] Header, offline banner, success toast, confirm and app dialogs, status/retry line, page header, form field, create feedback, autocomplete placeholders and accessible names, number stepper, sync-pending badge: all text from the catalogs, EN and FR
- [ ] Garde Status labels (Too young / Ready / Past peak / Not assessed; Trop jeune / À boire / Passé / Non évalué) and Color labels (Red/White/Rosé; Rouge/Blanc/Rosé) looked up from the stored values, per `docs/i18n-vocabulary.md`; stored values and API payloads unchanged
- [ ] Backend error codes map to `errors.<code>` keys, one per code per language; the client network message is localized; an unknown code shows the generic message in the active language
- [ ] Error mapping works outside components (used by composables and the outbox display path) and follows the active locale
- [ ] Sync-status page, header indicator and "not yet synced" badges fully translated; entity labels used for the counts get separate display names so translating them cannot break their lookups
- [ ] A failed queued item stored before a language switch renders its reason in the new language (the outbox keeps storing only the code)
- [ ] Plurals correct in both languages ("1 change" / "2 changes", French zero singular)
- [ ] Existing English tests pass unchanged; French smoke tests for the shell, a Garde Status badge, a Color label, an error message and the sync page; parity test green
- [ ] No API, schema or `api.http` change
