import { afterEach } from 'vitest'
import type { Router } from 'vue-router'
import { useHighlight } from '../composables/useHighlight'
import { useSuccessMessage } from '../composables/useSuccessMessage'

export function withAutoClear<T extends Router>(router: T): T {
  useSuccessMessage().attachAutoClear(router)
  useHighlight().attachAutoClear(router)
  return router
}

export function resetSuccessMessageAfterEach(): void {
  afterEach(() => {
    useSuccessMessage().clear()
    useHighlight().clear()
  })
}
