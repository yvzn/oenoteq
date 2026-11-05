import { ref } from 'vue'
import { countUnsentChanges, withdrawConsent } from './withdrawal'

export type WithdrawalPhase = 'idle' | 'working' | 'confirming' | 'failed'

// The withdraw flow as screens see it: sync first, ask only when changes would be lost,
// then delete and reload. Cancelling leaves everything as it was.
export function useWithdrawal(destination: () => string) {
  const phase = ref<WithdrawalPhase>('idle')
  const unsent = ref(0)

  async function proceed() {
    phase.value = 'working'
    try {
      await withdrawConsent(destination())
    } catch {
      phase.value = 'failed'
    }
  }

  async function start() {
    phase.value = 'working'
    try {
      unsent.value = await countUnsentChanges()
    } catch {
      phase.value = 'failed'
      return
    }
    if (unsent.value > 0) phase.value = 'confirming'
    else await proceed()
  }

  function cancel() {
    phase.value = 'idle'
  }

  return { phase, unsent, start, confirm: proceed, cancel }
}
