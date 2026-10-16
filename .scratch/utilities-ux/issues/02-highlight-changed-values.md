# 02: Highlight changed values, plus "Edit pairings" label

**What to build:** when a change is already visible on screen, there is no toast; the changed value stays highlighted until the user navigates away, and screen readers still hear the confirmation. On wine detail: adjusting quantity highlights the quantity; recording a Consumption highlights the new row and the quantity; editing a Consumption highlights the edited row; deleting one highlights the quantity. On the Meal Pairing page: adding a pairing highlights the added row. The wine detail button next to "Suggested meals" reads "Edit pairings" / "Modifier les accords". See `.scratch/utilities-ux/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The six in-place actions highlight instead of showing a toast
- [ ] Highlights persist until navigation, accumulate across actions, re-highlighting is a no-op
- [ ] The confirmation text is announced through a visually hidden polite live region
- [ ] Still toasts: saves followed by a redirect, list deletions, "Meal pairing removed"
- [ ] Highlight readable in light and dark
- [ ] Button label "Edit pairings" / "Modifier les accords" in both languages
- [ ] Tests (existing wine detail and meal pairing view seams): each action marks the right value, shows no toast, announces the text; highlight gone after navigation; new label
