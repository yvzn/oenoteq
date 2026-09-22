# 01: Frontend skeleton + Cellar list (read-only)

**What to build:** Stand up the app's foundations and the first real screen. A cellar owner opens the app and sees their full list of wines rendered with the intended visual direction, replacing today's placeholder. Every later ticket builds on the seams established here (router, API client, test harness) instead of inventing its own.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `vue-router` added; app shell has a header with top-level nav (a "Cellar" link at minimum — later tickets add more)
- [x] Tailwind CSS wired into the Vite build
- [x] `src/api/client.ts` (thin fetch wrapper: base path, JSON parsing, error normalization) and `src/api/types.ts` (hand-written types mirroring `api.http`'s JSON shapes) established as the one seam all API access goes through; the inline `Wine` interface in `App.vue` is removed in favor of this
- [x] `vite.config.ts` dev proxy extended to cover all API paths used so far (`/wines`, `/health`, plus any added in this ticket)
- [x] Vitest + Vue Test Utils configured and runnable (`npm run test` or equivalent)
- [x] Home route (`/`) renders the full list of wines (unfiltered — filtering is ticket 02), each showing at least producer, appellation, millesime, color, quantity, and garde status (too_young/ready/past_peak) as a visible badge/flag
- [x] Loading and error states are visibly distinct (not a silent blank screen)
- [x] `App.vue`'s placeholder fetch-and-count logic is fully replaced
- [x] Component/composable tests cover the list rendering and the API client's error normalization, following the spec's testing seam (mount + assert on rendered output, not internals)

## Comments

`garde_status` is not returned by `GET /wines` (only by `GET /search`, which excludes quantity=0 wines and so can't serve a full-list requirement). Implemented as a client-side pure function (`src/domain/gardeStatus.ts`) mirroring the backend's `gardeStatus()` logic exactly, computed from `/wines` + `/appellations`. Reused by Wine Detail (ticket 03).
