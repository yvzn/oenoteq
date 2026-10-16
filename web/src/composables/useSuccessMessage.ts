import { computed, ref } from 'vue'
import type { Router, RouteLocationRaw } from 'vue-router'

interface QueuedMessage {
  text: string
}

// Module-level, not per-call: one shared FIFO queue for the whole app,
// unlike other composables in this directory which hold their own state.
// Only the head is shown; Dismiss advances. No timer.
const queue = ref<QueuedMessage[]>([])
const message = computed(() => queue.value[0]?.text ?? null)

// The entry queued by showAndNavigate, kept through the very next afterEach
// while everything else queued is dropped. Safe while routes have no
// guards/redirects (every push resolves to a distinct route); revisit if that
// changes.
let carried: QueuedMessage | null = null

function show(text: string) {
  queue.value.push({ text })
}

function showAndNavigate(text: string, to: RouteLocationRaw, router: Router) {
  const entry = { text }
  queue.value.push(entry)
  carried = entry
  return router.push(to)
}

function dismiss() {
  queue.value.shift()
}

function clear() {
  queue.value = []
  carried = null
}

function attachAutoClear(router: Router) {
  router.afterEach(() => {
    const keep = carried
    carried = null
    // Only keep it if still queued: a dismissed carried entry must not return.
    queue.value = keep && queue.value.includes(keep) ? [keep] : []
  })
}

export function useSuccessMessage() {
  return { message, show, showAndNavigate, dismiss, clear, attachAutoClear }
}
