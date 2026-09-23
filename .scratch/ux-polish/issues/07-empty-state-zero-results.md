# 07: Empty state when filters yield zero results

**What to build:** User whose filter combination matches no wines sees an explicit "No wines match these filters" message, instead of a blank page indistinguishable from loading or broken.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] CellarListView renders a StatusLine ("No wines match these filters.") when `results.length === 0`, as a sibling branch to the existing loading/error/list branches
- [x] Empty-state branch only shows once loading is finished and there's no error (doesn't flash during load)
- [x] Normal list rendering unaffected when results exist
