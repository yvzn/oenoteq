import { computed, ref } from 'vue'
import type { Router } from 'vue-router'

interface Announcement {
  seq: number
  text: string
}

// Module-level, like useSuccessMessage: one shared set for the whole app.
// Keys accumulate until navigation; highlighting a key twice is a no-op.
const keys = ref<Set<string>>(new Set())
const announcements = ref<Announcement[]>([])
let seq = 0

// Marks a value as changed and announces the confirmation text politely.
// Every call announces, even for an already-highlighted key.
function highlight(key: string | string[], announcement: string) {
  for (const k of Array.isArray(key) ? key : [key]) keys.value.add(k)
  // Latest only: a fresh seq is a fresh node, so repeated text is re-announced.
  announcements.value = [{ seq: ++seq, text: announcement }]
}

function isHighlighted(key: string): boolean {
  return keys.value.has(key)
}

function clear() {
  keys.value = new Set()
  announcements.value = []
}

function attachAutoClear(router: Router) {
  router.afterEach(clear)
}

const announcement = computed(() => announcements.value[0]?.text ?? null)

export function useHighlight() {
  return { highlight, isHighlighted, announcement, announcements, clear, attachAutoClear }
}
