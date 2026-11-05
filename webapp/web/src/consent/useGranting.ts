import { ref } from 'vue'
import { syncNow } from '../sync'
import { grantConsent } from './grantConsent'
import { reloadInto } from './reload'

export type GrantingPhase = 'idle' | 'downloading' | 'failed'

// Turns Offline Mode on and runs its first pull with visible progress, then reloads.
// A failed pull can be retried without granting again.
export function useGranting(destination: () => string) {
  const phase = ref<GrantingPhase>('idle')
  const progress = ref({ done: 0, total: 1 })

  async function download() {
    phase.value = 'downloading'
    progress.value = { done: 0, total: 1 }
    try {
      await syncNow((done, total) => (progress.value = { done, total }))
    } catch {
      phase.value = 'failed'
      return
    }
    reloadInto(destination())
  }

  function allow() {
    grantConsent()
    void download()
  }

  return { phase, progress, allow, retry: download }
}
