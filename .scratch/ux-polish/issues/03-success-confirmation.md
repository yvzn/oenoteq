# 03: Success confirmation on mutations

**What to build:** User recording a consumption, saving a wine, or adding/removing a meal pairing gets a visible transient confirmation that the action worked, instead of having to infer success from the list silently changing.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Recording a consumption (WineDetailView `submitConsumption`) shows a success confirmation
- [x] Wine create/update (WineFormView `submit`) shows a success confirmation before/during redirect to detail
- [x] Adding a meal pairing shows a success confirmation
- [x] Removing a meal pairing shows a success confirmation
- [x] Confirmation is transient (auto-dismisses or is clearly tied to the one action, not a permanent banner)
