import { computed, ref, watch } from 'vue'
import type { Table } from 'dexie'
import { friendlyMessageForCode } from '../api/errorMessages'
import { isOfflineMode } from '../consent/storageConsent'
import { db } from '../db/localDb'
import type { WineInput } from '../api/types'
import { pushChangesInBackground, syncNow } from '../sync'
import type { MealPairingAddPayload } from '../sync/mealPairingSync'
import { clearQueue } from '../sync/clearQueue'
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

export interface PendingSyncItem {
  id: number
  // Entity bucket ("Wine", "Meal Pairing", ...), same as the counts.
  entity: string
  // Plain-language identity of the record, e.g. "Château X · Pomerol · 2015".
  label: string
  operation: string
  // ISO timestamp; null for items queued before createdAt was stored.
  queuedAt: string | null
}

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
// In queue (FIFO) order, so the list reads as "what will sync next".
const pendingItems = ref<PendingSyncItem[]>([])

function labelFor(item: OutboxItem): string {
  return ENTITY_LABELS[item.entity] ?? item.entity
}

function operationFor(item: OutboxItem): string {
  if (item.entity === 'quantity_adjustment') return 'Quantity adjustment'
  if (item.entity === 'consumption') return item.action === 'create' ? 'Consumption' : 'Consumption edit'
  if (item.entity === 'meal_pairing') return 'Pairing add'
  return item.action === 'create' ? 'Create' : 'Edit'
}

function joinWineParts(...parts: (string | number | null | undefined)[]): string | null {
  const present = parts.filter((part) => part != null)
  return present.length > 0 ? present.join(' · ') : null
}

async function wineLabel(wineId: number): Promise<string | null> {
  const wine = await db.wines.get(wineId)
  if (!wine) return null
  const appellation = await db.appellations.get(wine.appellation_id)
  return joinWineParts(wine.producer?.name, appellation?.name, wine.millesime)
}

async function wineLabelFromIds(p: Partial<WineInput>): Promise<string | null> {
  const [producer, appellation] = await Promise.all([
    p.producer_id == null ? undefined : db.producers.get(p.producer_id),
    p.appellation_id == null ? undefined : db.appellations.get(p.appellation_id),
  ])
  return joinWineParts(producer?.name, appellation?.name, p.millesime)
}

async function namedLabel(table: Table<{ name: string }, number>, item: OutboxItem): Promise<string | null> {
  const name = (item.payload as { name?: string } | null)?.name
  if (name) return name
  return (await table.get(item.targetId as number))?.name ?? null
}

// Best-effort human identity of the record an outbox item touches. Looked up
// from the local copy, so it still works offline; any miss falls back to the
// bare entity label rather than failing the whole list.
async function describeItem(item: OutboxItem): Promise<string> {
  const fallback = labelFor(item)
  const payload = (item.payload ?? {}) as Record<string, unknown>
  let described: string | null = null
  switch (item.entity) {
    case 'wine':
      described = await wineLabelFromIds(payload as Partial<WineInput>)
      break
    case 'quantity_adjustment':
      described = await wineLabel(item.targetId as number)
      break
    case 'consumption':
      if (typeof payload.wineId === 'number') {
        described = await wineLabel(payload.wineId)
      } else {
        const wines = await db.wines.toArray()
        const owner = wines.find((w) => w.consumption_history?.some((c) => c.id === item.targetId))
        described = owner ? await wineLabel(owner.id) : null
      }
      break
    case 'producer':
      described = await namedLabel(db.producers, item)
      break
    case 'appellation':
      described = await namedLabel(db.appellations, item)
      break
    case 'meal':
      described = await namedLabel(db.meals, item)
      break
    case 'meal_pairing': {
      const { appellationId, mealId, color } = payload as Partial<MealPairingAddPayload>
      const [meal, appellation] = await Promise.all([
        mealId == null ? undefined : db.meals.get(mealId),
        appellationId == null ? undefined : db.appellations.get(appellationId),
      ])
      described = meal && appellation ? `${meal.name} · ${appellation.name} (${color})` : null
      break
    }
  }
  return described ? `${fallback}: ${described}` : fallback
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
  // No Offline Mode, no local store to read (opening it would store data without consent).
  if (!isOfflineMode()) return
  const items = await db.outbox.toArray()
  const nextCounts = emptyCounts()
  const nextFailed: FailedSyncItem[] = []
  const pendingOutbox: OutboxItem[] = []
  for (const item of items) {
    const label = labelFor(item)
    if (item.status === 'failed') {
      nextFailed.push({ id: item.id!, label, reason: reasonForFailedItem(item.error ?? '') })
    } else if (label in nextCounts) {
      nextCounts[label]!++
      pendingOutbox.push(item)
    }
  }
  pendingOutbox.sort((a, b) => a.id! - b.id!)
  const nextPending = await Promise.all(
    pendingOutbox.map(async (item) => ({
      id: item.id!,
      entity: labelFor(item),
      label: await describeItem(item),
      operation: operationFor(item),
      queuedAt: item.createdAt ?? null,
    })),
  )
  counts.value = nextCounts
  failed.value = nextFailed
  pendingItems.value = nextPending
}

watch(outboxVersion, refresh, { immediate: true })

const hasPending = computed(
  () => Object.values(counts.value).some((count) => count > 0) || failed.value.length > 0,
)

const queuedCount = computed(
  () => Object.values(counts.value).reduce((sum, count) => sum + count, 0) + failed.value.length,
)

async function retryFailedItem(id: number): Promise<void> {
  await retry(db.outbox, id)
  pushChangesInBackground()
}

async function discardFailedItem(id: number): Promise<void> {
  await discard(db.outbox, id)
}

const isSyncing = ref(false)

// Discards the whole outbox, then pulls (when online) so local data converges
// on server state. Offline, the pull is skipped: the local rollback in
// clearQueue already removed what it could, and the reconnect sync finishes
// the job. A failed pull isn't an error here — the queue is already cleared.
async function clearAllQueued(): Promise<void> {
  await clearQueue()
  if (navigator.onLine === false) return
  try {
    await syncNow()
  } catch {
    // The next reconnect/manual sync retries the pull.
  }
}

// Guarded against double-trigger; always refreshes afterwards, even if the
// sync itself failed, so the page shows whatever state the outbox ended in.
async function syncAllNow(): Promise<void> {
  if (isSyncing.value) return
  isSyncing.value = true
  try {
    await syncNow()
  } catch {
    // Failures surface as failed outbox items; nothing else to show here.
  } finally {
    isSyncing.value = false
    await refresh()
  }
}

export function useSyncStatus() {
  return {
    counts,
    failed,
    pendingItems,
    hasPending,
    queuedCount,
    isSyncing,
    syncAllNow,
    entityLabels: ENTITY_DISPLAY_LABELS,
    refresh,
    retryFailedItem,
    discardFailedItem,
    clearAllQueued,
  }
}
