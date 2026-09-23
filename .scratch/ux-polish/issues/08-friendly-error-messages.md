# 08: Friendly error messages for the UI

**What to build:** User hitting an API error (bad input, missing wine, etc.) sees a message that says what happened and what to do, not a raw backend string. Backend keeps returning stable, technical **error codes** (e.g. `invalid_wine_id`) instead of free-text prose; frontend owns the copy and maps each code to a user-facing message (Norman's rule: what happened + what to do), falling back to a generic message for unmapped codes.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `internal/handlers/handlers.go` error responses use a fixed set of machine-readable codes instead of free-text strings (e.g. "invalid request", "invalid wine id", "invalid meal_id", "invalid appellation_id")
- [x] Passthrough `err.Error()` cases (raw db/driver errors) replaced with codes too — no raw SQL/driver text reaches the client
- [x] Frontend has a code → friendly message mapping, used wherever API errors are shown (cellar list, wine detail, wine form, meal pairings)
- [x] Unmapped/unknown codes fall back to a generic friendly message, not the raw code
- [x] Existing error UI (StatusLine et al.) unchanged in shape, just receives friendlier text
