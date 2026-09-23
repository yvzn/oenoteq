import { afterEach } from 'vitest'
import type { Router } from 'vue-router'
import { useSuccessMessage } from '../composables/useSuccessMessage'

export function withAutoClear<T extends Router>(router: T): T {
  useSuccessMessage().attachAutoClear(router)
  return router
}

export function resetSuccessMessageAfterEach(): void {
  afterEach(() => {
    useSuccessMessage().clear()
  })
}
