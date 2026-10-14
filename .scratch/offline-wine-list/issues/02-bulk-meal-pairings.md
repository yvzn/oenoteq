# 02: Bulk meal pairings

**What to build:** every Meal Pairing is available locally, so the meal filter can later work offline for any appellation and color, including ones the user never opened. The server gains one read that returns every pairing edge, and the full sync pulls it into the local pairings table without losing edges that still have an unsent add or remove. See `.scratch/offline-wine-list/spec.md` and ADR 0006.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A new server read returns every pairing edge (appellation, color, meal) in one response; an empty set returns an empty list; it is consistent with the existing per-combination read
- [x] `api.http` has a matching request; the existing per-combination endpoint is unchanged
- [x] Server tests cover: all edges returned, the empty case, and consistency with the per-combination read, through the existing handler test harness
- [x] The full sync pulls the bulk read into the local pairings table, replacing server-known edges while keeping edges that still have a pending add or pending remove in the outbox
- [x] Sync tests cover: a fresh pull fills the table, a pull does not drop a pending add, a pull does not resurrect a pending remove, an edge removed on the server disappears locally once nothing is pending for it
- [x] The existing per-combination pairing view still works online and offline, unchanged
- [x] Failures of this pull don't break the rest of the sync
