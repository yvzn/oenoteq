import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/localDb'
import { pushChangesInBackground } from '../sync'
import { enqueue } from '../sync/outbox'
import { useSyncStatus } from './useSyncStatus'

vi.mock('../sync', () => ({ pushChangesInBackground: vi.fn() }))

afterEach(() => {
  vi.mocked(pushChangesInBackground).mockReset()
})

// The `watch(outboxVersion, refresh)` that keeps this composable's state
// live fires the async refresh() fire-and-forget, so a plain `await
// enqueue(...)` isn't enough to observe it having settled.
async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('useSyncStatus', () => {
  it('starts with every entity count at zero and no failed items', async () => {
    const { counts, failed, hasPending } = useSyncStatus()
    await useSyncStatus().refresh()

    expect(counts.value).toEqual({
      Wine: 0,
      Consumption: 0,
      Producer: 0,
      Appellation: 0,
      Meal: 0,
      'Meal Pairing': 0,
    })
    expect(failed.value).toEqual([])
    expect(hasPending.value).toBe(false)
  })

  it('counts pending items per entity, folding quantity_adjustment into Wine', async () => {
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })
    await enqueue(db.outbox, { entity: 'quantity_adjustment', action: 'create', targetId: 5, payload: {} })
    await enqueue(db.outbox, { entity: 'meal_pairing', action: 'create', targetId: '1:rouge:2', payload: {} })

    const { counts, hasPending } = useSyncStatus()
    await useSyncStatus().refresh()

    expect(counts.value.Wine).toBe(2)
    expect(counts.value['Meal Pairing']).toBe(1)
    expect(hasPending.value).toBe(true)
  })

  it('lists failed items with a friendly reason, separately from the pending counts', async () => {
    const id = await enqueue(db.outbox, { entity: 'producer', action: 'update', targetId: 3, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'producer_not_found' })

    const { counts, failed } = useSyncStatus()
    await useSyncStatus().refresh()

    expect(counts.value.Producer).toBe(0)
    expect(failed.value).toEqual([
      { id, label: 'Producer', reason: "That producer doesn't exist anymore. Recreate it, then retry." },
    ])
  })

  it('swaps in a "recreate it, then retry" suggestion for any *_not_found code, even one with different wording', async () => {
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'update', targetId: 9, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'wine_not_found' })

    const { failed } = useSyncStatus()
    await useSyncStatus().refresh()

    expect(failed.value).toEqual([
      { id, label: 'Wine', reason: "Couldn't find that wine. Recreate it, then retry." },
    ])
  })

  it('leaves non "*_not_found" failure copy untouched, since it already suggests a fitting next step', async () => {
    const id = await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'already_exists' })

    const { failed } = useSyncStatus()
    await useSyncStatus().refresh()

    expect(failed.value).toEqual([
      { id, label: 'Producer', reason: 'That name is already in use. Choose a different one.' },
    ])
  })

  it('recomputes automatically whenever the outbox changes, without an explicit refresh() call', async () => {
    const { counts, hasPending } = useSyncStatus()
    await useSyncStatus().refresh()
    expect(hasPending.value).toBe(false)

    await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -1, payload: {} })
    await flushPromises()

    expect(hasPending.value).toBe(true)
    expect(counts.value.Meal).toBe(1)
  })

  it('retries a failed item by resetting it to pending and triggering a background push', async () => {
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'update', targetId: 1, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'wine_not_found' })
    const { failed, retryFailedItem } = useSyncStatus()
    await useSyncStatus().refresh()
    expect(failed.value).toHaveLength(1)

    await retryFailedItem(id)

    const item = await db.outbox.get(id)
    expect(item).toMatchObject({ status: 'pending', error: null })
    expect(pushChangesInBackground).toHaveBeenCalledTimes(1)
    expect(failed.value).toHaveLength(0)
  })

  it('discards a failed item permanently', async () => {
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'update', targetId: 1, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'wine_not_found' })
    const { failed, discardFailedItem } = useSyncStatus()
    await useSyncStatus().refresh()
    expect(failed.value).toHaveLength(1)

    await discardFailedItem(id)

    expect(await db.outbox.get(id)).toBeUndefined()
    expect(failed.value).toHaveLength(0)
  })
})
