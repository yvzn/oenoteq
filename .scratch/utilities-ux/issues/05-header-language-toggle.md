# 05: FR | EN in the header

**What to build:** the header shows a plain-text `FR | EN` toggle at the top right on every page, no flags, with the active language in bold. Switching applies immediately without a reload. The Manage hub no longer has its own language switcher. See `.scratch/utilities-ux/spec.md`.

**Blocked by:** 04 (shares the header; forced order 04 → 05 → 07)

**Status:** done

- [x] `FR | EN` plain text at the top right of the header row on both layouts; active language bold, separator muted
- [x] Each option is a focusable button named in its own language, active one marked for assistive tech
- [x] Switching updates the UI in place
- [x] Manage hub switcher removed
- [x] Tests (existing header and Manage hub seams): switching changes language, active one marked, hub has no switcher
