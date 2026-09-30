import { describe, expect, it } from 'vitest'
import { db } from '../db/localDb'
import { discard, enqueue } from '../sync/outbox'
import { useSyncPending } from './useSyncPending'

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('useSyncPending', () => {
  it('is false when nothing is queued for this entity+id', async () => {
    const { pending } = useSyncPending(
      () => 'producer',
      () => 1,
    )
    await flushPromises()

    expect(pending.value).toBe(false)
  })

  it('is true once a create/update for this entity+id is queued, and flips back once discarded', async () => {
    const id = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 7, payload: {} })
    const { pending } = useSyncPending(
      () => 'meal',
      () => 7,
    )
    await flushPromises()
    expect(pending.value).toBe(true)

    await discard(db.outbox, id)
    await flushPromises()

    expect(pending.value).toBe(false)
  })
})
