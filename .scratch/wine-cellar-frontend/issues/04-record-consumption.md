# 04: Record Consumption

**What to build:** From a wine's Detail view, a cellar owner logs a consumption without leaving the screen, and immediately sees its effect.

**Blocked by:** 03

**Status:** done

- [x] Inline form on Wine Detail: date (required), rating 1–5 (optional), notes (optional)
- [x] Submitting calls `POST /wines/:id/consumptions`; on success, the Detail view's quantity and consumption history refresh to reflect the new state
- [x] When the wine's quantity is already 0, the form is disabled/blocked with a clear message explaining why (not a failed submit)
- [x] Tests cover: successful submission updating displayed state, and the zero-quantity blocked case
