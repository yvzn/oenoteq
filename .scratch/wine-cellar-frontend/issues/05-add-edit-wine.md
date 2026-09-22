# 05: Add / Edit Wine

**What to build:** A cellar owner adds a newly bought wine, or corrects a mistake on an existing one, through one consistent form — never blocked by a missing appellation.

**Blocked by:** 03

**Status:** done

- [x] Shared form component used at both `/wines/new` (POST) and `/wines/:id/edit` (PUT, pre-filled with current values)
- [x] Fields: millesime (optional), appellation, producer, color, garde_debut, garde_fin, quantity
- [x] Appellation picked via autocomplete against the existing list; when no match exists, an inline "create new appellation" path (`POST /appellations`) lets the user proceed without leaving the form
- [x] Color restricted to a fixed choice: rouge/blanc/rose
- [x] Client-side validation before submit: required fields present, `garde_debut` ≤ `garde_fin`, quantity ≥ 0
- [x] On successful save, navigates to the wine's Detail view (`/wines/:id`)
- [x] Tests cover: validation rules, inline appellation-create flow, and both create/edit submission paths
