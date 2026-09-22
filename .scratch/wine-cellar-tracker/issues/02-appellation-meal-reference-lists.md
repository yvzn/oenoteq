# 02: Appellation & Meal reference lists

**What to build:** Maintained reference lists for Appellation and Meal, each as its own resource: the cellar owner can list existing entries and add a new one. These are the controlled vocabularies that Wine, Meal Pairing, and search will key off in later tickets — free text is explicitly rejected per the spec.

**Blocked by:** 01 (Project skeleton)

**Status:** ready-for-agent

- [x] `Appellation` has a create endpoint (name) and a list endpoint
- [x] `Meal` has a create endpoint (name) and a list endpoint
- [x] Creating an Appellation/Meal that already exists (by name) is rejected rather than silently duplicated
- [x] Tests drive both endpoints through the real-SQLite HTTP seam: create then list, and the duplicate-rejection case
