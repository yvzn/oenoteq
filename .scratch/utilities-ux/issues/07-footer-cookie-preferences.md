# 07: Footer with Cookie preferences

**What to build:** every page (except the consent page) ends with a plain footer holding one text link, "Cookie preferences" / "Préférences cookies", which opens the consent settings page. The footer sits in the page flow, not fixed, with a little space below it so a toast never covers it. It becomes the only way in: the header Storage link and the Manage hub storage entry are removed, and user-facing consent wording says "Cookie preferences" instead of "Storage". Existing choices are not asked again. See `.scratch/utilities-ux/spec.md` and ADR 0010 (amended).

**Blocked by:** 05 (shares the header; forced order 04 → 05 → 07)

**Status:** ready-for-agent

- [ ] Footer in page flow with one link to the consent settings page; extra padding below it
- [ ] Header Storage link removed; Manage hub storage entry removed
- [ ] User-facing consent wording "Cookie preferences" / "Préférences cookies" in both languages; internal names and stored keys unchanged
- [ ] Consent-text version not bumped
- [ ] Tests (existing header and Manage hub seams, one small footer test): link reaches consent settings; no Storage link in header or hub
