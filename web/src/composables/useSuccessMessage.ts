import { ref } from 'vue'
import type { Router, RouteLocationRaw } from 'vue-router'

// Module-level, not per-call: one shared success message for the whole app,
// unlike other composables in this directory which hold their own state.
const message = ref<string | null>(null)

// Not tied to the specific navigation that set it — just "don't clear on the
// very next afterEach". Safe while routes have no guards/redirects (every
// push resolves to a distinct route); revisit if that changes.
let carryOnce = false

function show(text: string) {
  message.value = text
  carryOnce = false
}

function showAndNavigate(text: string, to: RouteLocationRaw, router: Router) {
  message.value = text
  carryOnce = true
  return router.push(to)
}

function clear() {
  message.value = null
  carryOnce = false
}

function attachAutoClear(router: Router) {
  router.afterEach(() => {
    if (carryOnce) {
      carryOnce = false
      return
    }
    message.value = null
  })
}

export function useSuccessMessage() {
  return { message, show, showAndNavigate, clear, attachAutoClear }
}
