# Wine Cellar — Cookie Consent UX (first-visit page and Cookie preferences)

Status: ready-for-agent

## Problem Statement

The Cookie Consent page and the Cookie preferences page share one long explanation (~150 words, four headed sections and three fine-print lines) that users must read before the buttons make sense. The page is titled after cookies but never uses that word again, so it throws away the mental model users already have. The users' first worry about cookies — ads and tracking — is never answered. The refuse button, "Continue without", only makes sense after reading the paragraph above it. On Cookie preferences, the current state is a sentence lost among paragraphs, and the explanation talks conditionally ("would be stored") about data that is already stored.

## Solution

Lean on the familiar cookie pattern: one headline, one short paragraph, two choices labelled by outcome, details behind a disclosure.

- **Consent page:** headline "Cookies? Only one kind." with a lead saying the only use is keeping the cellar on the device so it works without signal, and "No ads. No tracking." Two same-size buttons, "Allow offline mode" (filled) / "Online only" (outlined), each with a one-line hint. A collapsed "What exactly is saved?" disclosure holds the full detail (what is stored, what refusing costs, sign-in, the choice record). One line says where to change the choice later.
- **Cookie preferences page:** a status row first — "Offline mode" with an On/Off badge and one sentence on what that means — then a single "Turn off offline mode" / "Turn on offline mode" button, then the same collapsed disclosure. No re-pitch.

All text in English and French.

## User Stories

1. As a first-time user, I want the consent page to use the cookie word I already know, so that I understand at once what is being asked.
2. As a first-time user, I want to be told there are no ads and no tracking, so that my usual cookie worry is answered before I choose.
3. As a first-time user, I want each button to name what I get ("Allow offline mode" / "Online only"), so that I can choose without reading the details.
4. As a first-time user, I want the full detail available but folded away, so that I can check exactly what is saved if I care to.
5. As a user on Cookie preferences, I want to see at a glance whether offline mode is on or off, so that I know where I stand.
6. As a user on Cookie preferences, I want one button that turns offline mode on or off, so that changing my mind is one obvious step.
7. As a French-speaking user, I want both pages in French, so that I can choose in my language.

## Implementation Decisions

- **One shared disclosure.** `ConsentExplanation` becomes a native `<details>` ("What exactly is saved?"), collapsed by default, holding the stored-items list, the cost of refusing, the sign-in note and the choice-record note. Both pages use it. The lead paragraph and the "change later" line live on the consent page only.
- **Equal weight, filled and outlined** (ADR 0010, amended to define equal weight): "Allow offline mode" is the filled primary button, "Online only" a new `outline` button variant at primary size, same font and brand colour. Both are auto-sized (not stretched), side by side and well apart; neither is pre-selected. On Cookie preferences, turning on and turning off use the same secondary variant — a setting change, not the page's call to action, and withdrawing is as easy as granting.
- **"No ads. No tracking." is a product invariant.** It is true today (no client analytics; infra skips Log Analytics). Adding any analytics or third-party tracker means changing this copy and bumping the consent-text version.
- **Consent-text version not bumped.** Same storage scope, same two choices: the wording is meaning-equivalent, so existing choices are not asked again.
- **Wording.** "Offline mode" / "Mode hors ligne" becomes the visible name of Offline Mode on these pages. i18n key names and code identifiers keep "consent" / "storage". Removed keys: `consent.intro`, `consent.whatTitle`, `consent.whyTitle`, `consent.why`, `consent.refuseTitle`. New keys: `consent.lead`, `consent.details`, `storage.offlineMode`, `storage.on`, `storage.off`.
- **Flows unchanged.** Granting, download progress, retry, withdrawal and the unsent-changes dialog are untouched; only text and layout change.
- **No backend impact.** No API change, no `api.http` change, no schema or migration. No ADR or glossary change.

## Testing Decisions

- Existing seams only: `ConsentView` and `ConsentChangeView` view tests update their text assertions (headline, disclosure content, status row, French strings). The equal-weight assertion becomes: both choices are enabled one-tap buttons, neither pre-selected, and "Online only" is the outlined variant at primary size.
- The i18n key-parity test covers every new or removed string in both languages.
- Both Vitest projects (offline-mode, online-only) must pass.
- Not tested automatically: layout of the status row and disclosure — verified by hand at ~375px and ~1280px.

## Out of Scope

- Bumping the consent-text version.
- A banner or bottom-sheet consent pattern (ADR 0010 keeps a full page).
- Privacy policy or legal notice pages.
- Renaming i18n keys or code identifiers.

## Further Notes

- Rationale follows Steve Krug's *Don't Make Me Think*: use conventions, self-evident labels, cut words, answer the user's real worry, make "where am I" obvious on the settings page.
- Suggested check: a hallway test with three people — "what happens if you click the right-hand button?" — answered without opening the disclosure.
