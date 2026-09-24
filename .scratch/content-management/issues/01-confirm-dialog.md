# 01: Shared ConfirmDialog component

**What to build:** A reusable confirmation dialog component that any delete action can invoke before actually deleting. No modal/dialog component exists in the codebase today, so this establishes the pattern from scratch. It takes a message (what's about to be deleted) and exposes confirm/cancel outcomes to its caller — nothing wired to any real delete flow yet, that happens in tickets 02/03/04/06.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A `ConfirmDialog` component exists, showing a message and Confirm/Cancel actions
- [x] Cancel closes the dialog and performs no action
- [x] Confirm closes the dialog and signals confirmation to the caller (e.g. emits an event / resolves a promise)
- [x] Component has its own test covering open, cancel, and confirm behavior in isolation
- [x] Visually/behaviorally consistent with existing shared components (matches the app's existing button/typography conventions, e.g. `AppButton`)
