# 01: Frontend skeleton + Cellar list (read-only)

**What to build:** Stand up the app's foundations and the first real screen. A cellar owner opens the app and sees their full list of wines rendered with the intended visual direction, replacing today's placeholder. Every later ticket builds on the seams established here (router, API client, test harness) instead of inventing its own.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `vue-router` added; app shell has a header with top-level nav (a "Cellar" link at minimum — later tickets add more)
- [ ] Tailwind CSS wired into the Vite build
- [ ] `src/api/client.ts` (thin fetch wrapper: base path, JSON parsing, error normalization) and `src/api/types.ts` (hand-written types mirroring `api.http`'s JSON shapes) established as the one seam all API access goes through; the inline `Wine` interface in `App.vue` is removed in favor of this
- [ ] `vite.config.ts` dev proxy extended to cover all API paths used so far (`/wines`, `/health`, plus any added in this ticket)
- [ ] Vitest + Vue Test Utils configured and runnable (`npm run test` or equivalent)
- [ ] Home route (`/`) renders the full list of wines (unfiltered — filtering is ticket 02), each showing at least producer, appellation, millesime, color, quantity, and garde status (too_young/ready/past_peak) as a visible badge/flag
- [ ] Loading and error states are visibly distinct (not a silent blank screen)
- [ ] `App.vue`'s placeholder fetch-and-count logic is fully replaced
- [ ] Component/composable tests cover the list rendering and the API client's error normalization, following the spec's testing seam (mount + assert on rendered output, not internals)
