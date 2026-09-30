import { computed, ref, watch } from 'vue'
import { friendlyMessageForCode } from '../api/errorMessages'
import { db } from '../db/localDb'
import { pushChangesInBackground } from '../sync'
import { discard, outboxVersion, retry, type OutboxItem } from '../sync/outbox'

// The six entity types the sync-status page reports on. `quantity_adjustment`
// has no bucket of its own — it's a correction against a Wine's stock, not a
// distinct record type from the user's point of view, so it's folded into
// "Wine".
const ENTITY_LABELS: Record<string, string> = {
  wine: 'Wine',
  consumption: 'Consumption',
  producer: 'Producer',
  appellation: 'Appellation',
  meal: 'Meal',
  meal_pairing: 'Meal Pairing',
  quantity_adjustment: 'Wine',
}

// Derived, not hand-kept in sync with ENTITY_LABELS: its six values, in
// first-occurrence order, are exactly the six display buckets the
// sync-status page reports on.
export const ENTITY_DISPLAY_LABELS = [...new Set(Object.values(ENTITY_LABELS))]

export interface FailedSyncItem {
  id: number
  label: string
  reason: string
}

function emptyCounts(): Record<string, number> {
  return Object.fromEntries(ENTITY_DISPLAY_LABELS.map((label) => [label, 0]))
}

// Module-level, shared state: the header indicator (mounted once for the
// app's lifetime) and the routed sync-status page both need to observe the
// exact same live counts, including mutations (retry/discard) made from the
// other one.
const counts = ref<Record<string, number>>(emptyCounts())
const failed = ref<FailedSyncItem[]>([])

function labelFor(item: OutboxItem): string {
  return ENTITY_LABELS[item.entity] ?? item.entity
}

// The shared error copy in api/errorMessages.ts is written for a live form
// ("Refresh the page and try again") — meaningless for a queued background
// item sitting next to this page's own Retry/Discard buttons. For the
// "referenced record no longer exists" family, swap in the remediation the
// ticket actually asks for: recreate the record, then retry.
function reasonForFailedItem(code: string): string {
  const message = friendlyMessageForCode(code)
  if (!code.endsWith('_not_found')) return message
  const [reason] = message.split(/\.\s+/, 1)
  return `${reason}. Recreate it, then retry.`
}

async function refresh(): Promise<void> {
  const items = await db.outbox.toArray()
  const nextCounts = emptyCounts()
  const nextFailed: FailedSyncItem[] = []
  for (const item of items) {
    const label = labelFor(item)
    if (item.status === 'failed') {
      nextFailed.push({ id: item.id!, label, reason: reasonForFailedItem(item.error ?? '') })
    } else if (label in nextCounts) {
      nextCounts[label]!++
    }
  }
  counts.value = nextCounts
  failed.value = nextFailed
}

watch(outboxVersion, refresh, { immediate: true })

const hasPending = computed(
  () => Object.values(counts.value).some((count) => count > 0) || failed.value.length > 0,
)

async function retryFailedItem(id: number): Promise<void> {
  await retry(db.outbox, id)
  pushChangesInBackground()
}

async function discardFailedItem(id: number): Promise<void> {
  await discard(db.outbox, id)
}

export function useSyncStatus() {
  return {
    counts,
    failed,
    hasPending,
    entityLabels: ENTITY_DISPLAY_LABELS,
    refresh,
    retryFailedItem,
    discardFailedItem,
  }
}
