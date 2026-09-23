# 05: Consistent max-width convention

**What to build:** User viewing the cellar list on a large screen no longer sees wine cards stretched edge-to-edge; list content width follows the same convention already used on wine detail (`max-w-2xl`), just wider since it's a list of cards, not prose.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Cellar list content wrapper gets a max-width (e.g. `max-w-4xl`) applied at the same wrapper level as wine detail's `max-w-2xl`
- [ ] Wine cards no longer stretch to full viewport width on large screens
- [ ] Detail, form, and meal-pairing screens checked for the same convention and left consistent
