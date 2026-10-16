# Wine Cellar — Utilities UX (sync pill, language toggle, toast, footer)

Status: ready-for-agent

## Problem Statement

The utilities around the cellar get in the user's way. The top right of the header mixes a sync link that only appears when something is pending with a "Storage" link, while the language switcher is hidden away on the Manage hub. Confirmations pop up top-right in a single slot, so a second one silently replaces the first, and they appear even when the change is already visible on screen. Losing the connection shows a fixed bottom banner that competes with confirmations for the same space. The wine detail page has a second "Manage" button that clashes with the main "Manage" tab, and "Storage" is a technical word for what users know everywhere else as cookie consent. On mobile, the header row is too narrow to hold every utility.

## Solution

The header holds just two utilities: a sync status pill and a plain `FR | EN` language toggle. The pill tells the user, in a word and a count, where their Changes to Sync stand — offline, waiting, syncing, failed, or synced — and opens the "Changes to sync" page when clicked, starting a sync when that is what the user would expect. On mobile, the pill moves to the right end of the tabs row. Confirmations appear one at a time at the bottom center, stay until the user dismisses them, and queue instead of stacking. When the change is already on screen, there is no confirmation — the changed value stays highlighted until the user navigates away. Losing the connection shows a single toast; reconnecting shows nothing, since the pill already says so. A plain footer at the bottom of the page holds the "Cookie preferences" link. The pairing button on wine detail reads "Edit pairings".

## User Stories

### Sync status pill

1. As a user with Offline Mode on, I want a pill in the header that tells me in a word and a count how my Changes to Sync stand, so that I know at a glance whether my changes have reached the server.
2. As a user with Offline Mode on and nothing pending, I want the pill to show a quiet "Synced", so that I know everything is safe without the pill drawing attention.
3. As a user with Offline Mode on, I want the pill always present (even when synced), so that the header layout doesn't jump around as sync state changes.
4. As a user who is offline with changes made, I want the pill to read "Offline · N changes saved", so that I know my work is kept on the device and will sync later.
5. As a user online with queued changes, I want the pill to read "N changes to sync", so that I know something is still waiting.
6. As a user while a sync runs, I want the pill to read "Syncing…", so that I know the app is working on it.
7. As a user with a Change to Sync that failed, I want the pill to read "Sync failed · Retry", so that I notice the problem without a toast interrupting me.
8. As a user with a failed change while offline, I want the pill to read "Sync failed" without "Retry", so that I'm not offered an action that cannot work without a connection.
9. As a user in several states at once, I want the pill to show the most important one (failed, then offline, then syncing, then waiting, then synced), so that a failure is never hidden behind a less urgent state.
10. As a user, I want counts in the pill to use correct singular and plural forms in English and French, so that it doesn't read like a placeholder.
11. As a user, I want clicking "Sync failed · Retry" to open the Changes to Sync page and start a sync, so that "Retry" does what it says and I can watch the result.
12. As a user, I want clicking "N changes to sync" to open the Changes to Sync page and start a sync, so that clicking reads as "sync now".
13. As a user, I want clicking the pill while offline, syncing, synced, or failed-while-offline to open the Changes to Sync page without starting anything, so that I can just inspect what's pending.
14. As a user clicking the pill twice quickly, I want only one sync to run, so that I don't trigger duplicate work.
15. As a user on desktop, I want the pill at the top right of the header, next to the language toggle, so that status sits where I expect utilities.
16. As a user on mobile, I want the pill at the right end of the tabs row, so that the narrow header row isn't crowded.
17. As a user relying on a screen reader, I want the pill announced once with its full label, so that I'm not told the same status twice.
18. As a user who refused Cookie Consent, I want no pill at all, so that I'm not shown sync state for a feature I don't use.
19. As a user, I want the Changes to Sync page titled "Changes to sync" / "Modifications à synchroniser", so that it matches the pill that took me there.

### Language toggle

20. As a user, I want a plain `FR | EN` toggle in the header on every page, so that I can switch language without hunting for it in the Manage hub.
21. As a user, I want the active language shown in bold, so that I know which one is on.
22. As a user, I want the toggle as plain text without flags, so that languages aren't conflated with countries.
23. As a user, I want switching language to apply immediately without a reload, so that I don't lose a half-filled form.
24. As a user, I want the language toggle to be the only utility in the header besides the sync pill, so that the header stays uncluttered.
25. As a user on the Manage hub, I want no duplicate language switcher, so that there is one obvious place to change language.
26. As a keyboard or screen reader user, I want each language option to be a focusable button named in its own language, with the active one marked, so that I can switch and know which is active.

### Toast

27. As a user, I want confirmations to appear at the bottom center on both desktop and mobile, so that they're in the same predictable place.
28. As a user, I want a confirmation never to cover the header or a form field, so that I can keep working while it's shown.
29. As a user near the bottom of a form, I want to be able to scroll the last fields above a visible toast, so that the toast never blocks input.
30. As a user, I want confirmations to stay until I dismiss them, so that I don't miss one by looking away.
31. As a user, I want a Dismiss button on each confirmation, so that I can clear it when I've read it.
32. As a user who triggers two confirmations together, I want them to queue and show one after another, so that one doesn't replace or cover the other.
33. As a user who navigates away, I want pending confirmations cleared, so that I'm not shown stale messages on another page.
34. As a user who saves a wine, producer, meal or appellation and is redirected, I want the confirmation to appear on the page I land on, so that I know the save worked.
35. As a user, I want toasts used only for action confirmations, never for sync failures, so that failures live in one place — the pill.

### Highlight instead of toast

36. As a user adjusting a wine's quantity, I want the new quantity highlighted instead of a toast, so that my attention goes to the value that changed.
37. As a user recording a Consumption, I want the new consumption row and the decreased quantity highlighted, so that I see both effects of what I did.
38. As a user editing a Consumption, I want the edited row highlighted, so that I can confirm which entry changed.
39. As a user deleting a Consumption, I want the restored quantity highlighted, so that I see the effect even though the row is gone.
40. As a user adding a Meal Pairing, I want the added row highlighted, so that I can see it was added.
41. As a user making several changes on the same page, I want every changed value to stay highlighted, so that I can review all of them together.
42. As a user, I want highlights to stay until I navigate away, so that I don't miss one by looking away.
43. As a user relying on a screen reader, I want the same confirmation text announced politely when a value is highlighted, so that I'm still told the action worked.
44. As a user removing a Meal Pairing, deleting from a list, or saving and being redirected, I want a toast as before, so that I get confirmation when the changed thing is no longer on screen.

### Offline notice

45. As a user whose connection drops, I want one toast telling me so, so that I know right away without a permanent banner taking space.
46. As a user with Offline Mode on, I want the offline toast to say my changes are saved on the device, so that I keep working confidently.
47. As a user without Cookie Consent, I want the offline toast to say my changes can't be saved while offline, so that I don't lose work unknowingly.
48. As a user whose connection comes back, I want no toast, so that I'm not interrupted — the pill shows Syncing… then Synced.
49. As a user whose connection drops several times, I want one toast per drop, so that each new loss is noticed.
50. As a user whose connection returns while the offline toast is still up, I want it to stay until I dismiss it, so that it doesn't vanish under me.
51. As a user, I want the offline toast to queue with other toasts, so that it never stacks over a confirmation.

### Footer

52. As a user, I want a "Cookie preferences" link in a plain footer on every page, so that I can change my choice the way I would on any website.
53. As a user, I want the footer at the bottom of the page rather than fixed, so that it never collides with a toast.
54. As a user scrolling to the very bottom, I want a little space below the footer, so that a toast never covers the link.
55. As a user, I want "Cookie preferences" to be the single place to change my choice (no header link, no Manage hub entry), so that there's one obvious way in.
56. As a user, I want consent screens to say "Cookie preferences" / "Préférences cookies" instead of "Storage", so that I recognise what they are about.
57. As a user who already made a choice, I want the wording change not to ask me again, so that I'm not re-prompted for the same decision.

### Consent page

58. As a first-time user on the Cookie Consent page, I want a minimal header with the brand and `FR | EN`, so that I can read the consent text in my language before choosing.
59. As a first-time user on the Cookie Consent page, I want no tabs, pill or footer, so that nothing leads me away before I choose.

### Wording

60. As a user on wine detail, I want the button next to "Suggested meals" to read "Edit pairings" / "Modifier les accords", so that it isn't confused with the main "Manage" tab.
61. As a user, I want the "Edit pairings" label to make clear I'm editing the shared pairing for the Appellation and Color, so that I'm not surprised other wines change too.

## Implementation Decisions

- **Glossary.** Storage Consent is renamed **Cookie Consent**; new term **Change to Sync** (a change made in Offline Mode not yet on the server, queued or failed). ADR 0010 amended in place (2026-10-16): footer link instead of Manage hub, offline toast instead of banner, Cookie Consent naming. No new ADR.
- **Sync pill state.** A single derived pill state, computed from connectivity, the syncing flag, the queued count and the failed list, with fixed priority `failed > offline > syncing > pending > synced`. The count is the existing queued count (queued + failed); the failed state shows no number. The failed state carries whether retry is possible (online only).
- **Pill click.** Failed-while-online and pending: navigate to the Changes to Sync page and call the existing "sync all now" action (already guarded against double runs). Every other state: navigate only.
- **Pill placement.** Rendered once in the DOM; moved between the header row (≥ 640px) and the right end of the tabs row (< 640px) by CSS only — no duplicated markup.
- **Pill visibility.** Only while Offline Mode is on (ADR 0010). Replaces the current header sync link.
- **Language toggle.** A plain-text `FR | EN` header toggle built on the existing locale composable. The Manage hub switcher is removed. The existing switcher component is replaced by the toggle wherever it is used.
- **Toast queue.** The success message module changes from one slot to a FIFO queue: `show` enqueues, Dismiss pops, navigation clears everything except the message carried across the redirect by "show and navigate" (ADR 0003 behaviour kept). No timer. The toast moves to a bottom-center overlay. A bottom spacer is shown under main content only while a toast is visible.
- **Highlight.** A small module tracking highlighted element keys, cleared on route change, plus one visually hidden polite live region announcing the confirmation text. The six in-place call sites (quantity adjusted; consumption recorded / updated / deleted; meal pairing added ×2) highlight instead of calling the toast. All other call sites keep the toast.
- **Offline toast.** The offline banner component is removed. An online → offline transition enqueues one toast; its text reuses the existing offline strings (saved-locally variant with Offline Mode, not-saved variant without). Reconnect enqueues nothing.
- **Footer.** New footer in normal page flow with one link, "Cookie preferences", to the existing consent settings page; extra bottom padding below it. The header Storage link and the Manage hub storage entry are removed.
- **Consent page.** Gets its own minimal header (brand + toggle); the global header and footer are not shown on that route.
- **Wording.** User-facing consent strings say "Cookie preferences" / "Préférences cookies"; i18n key names, code identifiers and persisted keys keep "storage". The consent-text version is not bumped. Pending page title → "Changes to sync" / "Modifications à synchroniser" (route unchanged). Wine detail pairing button → "Edit pairings" / "Modifier les accords".
- **No backend impact.** No API change, no `api.http` change, no schema or migration.

## Testing Decisions

- Just enough tests: assert external behaviour (what the user sees and what happens on click), not internal state or CSS classes. No new test harness, no new Playwright tests.
- Existing seams only:
  - **Header component test** (prior art: the existing header test, which already mounts with a memory router, consent helper and seeded outbox): pill state per scenario including priority, click → navigation and sync triggered or not, hidden without consent; `FR | EN` switches language and marks the active one; Storage link gone.
  - **Toast component / success message tests** (prior art: the existing toast test and the success-message router helper): FIFO order, Dismiss advances, navigation clears, the redirect message survives one navigation; offline toast enqueued once per drop and not on reconnect (prior art: the existing offline banner test's connectivity setup, moved here).
  - **Wine detail and meal pairing view tests** (prior art: existing view tests): after each in-place action, the changed value is marked highlighted, no toast shows, the live region carries the text; highlight cleared on navigation. Updated label "Edit pairings".
  - **Sync status, Manage hub, Consent view tests**: new title; hub has no switcher and no storage entry; consent page shows the toggle.
  - **Footer**: one small test that the link reaches the consent settings page.
- The existing i18n key-parity test covers every new or changed string in both languages.
- Not tested automatically: the mobile/desktop pill placement, toast-not-covering-fields and footer flow — CSS only, verified by hand at ~375px and ~1280px.
- Both Vitest projects (offline-mode, online-only) must pass.

## Out of Scope

- Privacy policy and legal notice pages or links (illustration only in the mockup).
- Undo on toasts (illustration only; quantity syncs as signed adjustment events, ADR 0006).
- A Settings page.
- Renaming code identifiers, i18n keys or persisted keys from "storage" to "cookie".
- Bumping the consent-text version.
- Automated responsive/visual tests.

## Further Notes

- Source: UX team suggestions and `.scratch/utilities-ux/mockup.html`. The mockup's pill states and placement are authoritative; its toast "Undo" and footer Privacy/Legal links are not.
- The toast queue is the shared foundation: highlight and the offline toast both depend on it, so it lands first.
