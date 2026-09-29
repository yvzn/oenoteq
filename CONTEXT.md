# Wine Cellar

Personal, single-user app to track wines owned, their drinking window, and which meals pair well with them.

## Language

**Wine**:
The tracked entity: millesime + appellation + producer + color + garde + quantity on hand. No per-bottle identity — "bottle" is just the unit quantity is counted in, not a separate record. Quantity is always at least 1 when a Wine is first added — it only reaches 0 afterward, through Consumption or a manual correction. Stays in the cellar as a record even once quantity reaches 0, since Consumption history references it.
_Avoid_: Bottle (as an entity)

**Producer**:
A named entity for who made the wine (e.g. "Château Margaux", "Domaine Leflaive"), referenced by Wine rather than typed in free-hand per wine — same convention as Appellation. Type (château/domaine/maison/...) is treated as part of the name, not a separate field.
_Avoid_: Producer label, producer name (as if it were free text)

**Consumption**:
A record of drinking one unit of a Wine: date (required), rating 1-5 (optional), notes (optional). Decrements the Wine's quantity.
_Avoid_: Drink event, tasting

**Millesime**:
The vintage year a wine was produced. Optional — non-vintage wines (e.g. Champagne NV) have no Millesime.
_Avoid_: Vintage, year

**Garde**:
The drinking window for a wine, expressed as a range (`garde_debut` start year, `garde_fin` end year) rather than a single target year. Each bound is independently optional. A missing bound isn't "no limit" — it means no judgment has been made for that side yet.
_Avoid_: Peak year, optimal year

**Appellation**:
The designated wine-growing region/classification a wine is produced under (e.g. AOC-style designation). Combined with Color, determines the default Meal Pairing.
_Avoid_: Region, AOC (unless referring specifically to the French system)

**Color**:
The wine's category: rouge, blanc, or rose. Combined with Appellation, determines the default Meal Pairing.
_Avoid_: Type, category

**Meal**:
A named dish/food category (e.g. "Grilled steak", "Cheese plate") usable in a Meal Pairing. Exists as a standalone record independent of any pairing — a Meal with no pairings yet is still valid.
_Avoid_: Dish (as a distinct concept), food

**Meal Pairing**:
A shared, reusable lookup keyed by (Appellation, Color) that suggests which meals fit a wine. Not customized per wine.
_Avoid_: Food match, pairing (ambiguous alone)

**Garde Status**:
A Wine's position in its Garde window, derived (not stored) by comparing the current year to whichever of `garde_debut`/`garde_fin` are set: `too_young` (before garde_debut, if set), `ready` (inside the known window, or unconstrained on whichever side is unset), `past_peak` (after garde_fin, if set), or `unassessed` (both bounds unset — no judgment made yet, distinct from "ready"). Computed at read time, e.g. by Search. Search's "ready now" filter matches only `ready`; `unassessed` never qualifies.
_Avoid_: Drinking status, maturity, unknown (use "unassessed")

**Label Scan**:
Prefilling the Add Wine form's Millesime, Appellation, Producer, and Color from a photo of the bottle's etiquette, via client-side OCR. Always reviewed and submitted manually — never auto-adds a Wine. Garde and Quantity are never scanned: they're the user's own judgment/stock count, not printed on a label.
_Avoid_: OCR, photo import
