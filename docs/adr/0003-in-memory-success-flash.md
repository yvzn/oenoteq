---
status: accepted
---

# Carry success messages across navigation via an in-memory singleton, not sessionStorage or a query param

Saving a wine redirects to its detail page; the success confirmation needs to survive that redirect to be seen. Chosen: a module-level singleton (`useSuccessMessage`) holding the pending message in memory, set before `router.push` and consumed once on the next route's mount. Rejected sessionStorage, which also survives a hard refresh or back/forward restore — persistence nobody asked for, since Vue Router navigation never reloads the page. Rejected a `?flash=` query param too, since it pollutes the URL/history and needs manual stripping after read. Revisit if a flow ever needs the message to survive an actual full-page reload.

## Considered Options

- **In-memory singleton (chosen)**: simplest, correct for SPA-only navigation, gone on hard refresh (never needed to survive one).
- **sessionStorage**: same behavior plus survives hard refresh/back-forward restore — persistence beyond what any current flow requires.
- **Query param (`?flash=...`)**: visible in the URL and browser history, needs explicit strip-after-read to avoid re-showing on refresh/back.
