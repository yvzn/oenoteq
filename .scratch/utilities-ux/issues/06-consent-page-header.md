# 06: Consent page minimal header

**What to build:** the Cookie Consent page has its own minimal header — the brand and the `FR | EN` toggle, no tabs and no pill — so a first-time user can pick a language before choosing. The global header and footer are not shown there, and the page is no longer full-screen. See `.scratch/utilities-ux/spec.md`.

**Blocked by:** 05

**Status:** done

- [x] Own header with brand + `FR | EN` toggle; no tabs, no pill
- [x] No global header or footer on the consent page
- [x] The in-page language switcher on the consent page is replaced by the header toggle
- [x] Tests (existing consent view seam): toggle present and switches language before a choice is made
