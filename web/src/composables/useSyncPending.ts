import { ref, watch } from 'vue'
import { db } from '../db/localDb'
import { isQueued, outboxVersion } from '../sync/outbox'

// Whether a create/update for this entity+targetId is still queued in the
// outbox — the data behind the "not yet synced" badge.
export function useSyncPending(entity: () => string, targetId: () => number | string) {
  const pending = ref(false)

  async function check(): Promise<void> {
    pending.value = await isQueued(db.outbox, entity(), targetId())
  }

  watch([entity, targetId, outboxVersion], check, { immediate: true })

  return { pending }
}
