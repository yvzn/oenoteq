# 01: Cookie-framed consent and Cookie preferences pages

**What to build:** the consent page leads with "Cookies? Only one kind.", a short "no ads, no tracking" lead, two same-size outcome buttons, filled and outlined, ("Allow offline mode" / "Online only") and a collapsed "What exactly is saved?" disclosure. Cookie preferences shows an "Offline mode: On/Off" status row, one turn-on/turn-off button and the same disclosure. English and French. See `.scratch/consent-ux/spec.md`.

**Status:** done

- [x] Consent page: cookie headline, lead with "No ads. No tracking.", outcome-labelled buttons (filled allow, outlined refuse, same size, auto-width, well apart) with one-line hints; ADR 0010 amended, "change later" line
- [x] Shared collapsed disclosure holds what is stored, refusing cost, sign-in and choice-record notes
- [x] Cookie preferences: status row with On/Off badge, single secondary turn-on/turn-off button, no lead
- [x] EN and FR strings; removed keys gone from both catalogs
- [x] Consent-text version not bumped
- [x] View tests updated; both Vitest projects pass
