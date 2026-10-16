# 01: Toast queue at bottom center

**What to build:** confirmations appear at the bottom center on desktop and mobile, one at a time. Two confirmations fired together queue instead of replacing each other; each stays until the user presses Dismiss, then the next one shows. Navigating away clears pending confirmations, except the one carried across a save-and-redirect, which still appears on the landing page (ADR 0003). The toast never covers the header, and the last form fields can be scrolled above it. Prefactor for 02 and 03. See `.scratch/utilities-ux/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Toast shown bottom center on both layouts, never over the header
- [ ] Confirmations queue first-in first-out; only one visible at a time
- [ ] No auto-dismiss; Dismiss shows the next queued confirmation
- [ ] Navigation clears the queue; a save-and-redirect confirmation still shows on the landing page
- [ ] While a toast is visible, extra space below the content lets the last fields scroll clear of it
- [ ] Every existing confirmation still appears, unchanged in wording
- [ ] Tests (existing toast and success-message seams): queue order, Dismiss advances, navigation clears, redirect confirmation survives one navigation
