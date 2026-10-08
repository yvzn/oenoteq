# 03: Consent page, route gate and granting

**What to build:** on a first visit the user lands on a full-size Storage Consent page, in their language, with two equal unselected choices: allow the app to keep the cellar on this device (Offline Mode), or continue without it. Every route is gated until they choose, and they return to the page they wanted afterwards. Granting downloads the cellar with visible progress and a retry on failure, then starts Offline Mode. Refusing starts the online-only mode from ticket 02. See ADR 0010 and `.scratch/storage-consent/spec.md`.

**Blocked by:** 02 (Online-only mode), and the i18n foundation (`.scratch/i18n/issues/01`) for the catalogs and the language switcher

**Status:** ready-for-agent

- [ ] A full-size consent page (not a dialog or popup) with two equal-weight, unselected choices, each one tap; refusing is as easy as accepting
- [ ] Plain-language text, in English and French through the catalogs, covering what is stored (a copy of the cellar, a queue of unsent changes, an app cache for offline launch), why, what refusing costs (no offline use, no home-screen install), that sign-in is the hosting platform's and not covered, and how to change the choice later
- [ ] The reusable language switcher from the i18n foundation is on the page and works before any choice
- [ ] A router guard sends every route to the consent page while there is no choice, remembers the intended destination and returns the user there after choosing; only the consent page and the language switcher are reachable meanwhile
- [ ] Granting records the choice, registers the service worker, opens the local store and runs the first full pull (queued changes pushed first) with visible progress, an error state and a retry, then reloads into Offline Mode
- [ ] Refusing records the refusal (so the user isn't asked again) and reloads into online-only mode
- [ ] The language preference is now stored on the device only while consent is granted; refused or no choice keeps it in memory for the session
- [ ] The user isn't asked again on later visits
- [ ] Tests: the gate on every route, return to the intended destination, both choices end to end, first-pull progress/error/retry, language preference persistence rules, and the "nothing stored before a choice except the choice itself" boot test
- [ ] No API, schema or `api.http` change
