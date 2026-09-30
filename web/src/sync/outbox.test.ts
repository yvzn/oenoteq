import Dexie, { type Table } from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { discard, enqueue, isQueued, replay, retry, RetryableOutboxError, type OutboxHandler, type OutboxItem } from './outbox'

class TestDb extends Dexie {
  outbox!: Table<OutboxItem, number>

  constructor() {
    super(`outbox-test-${Math.random()}`)
    this.version(1).stores({ outbox: '++id, status, entity' })
  }
}

let db: TestDb

afterEach(async () => {
  await db?.delete()
})

function makeDb(): TestDb {
  db = new TestDb()
  return db
}

describe('outbox', () => {
  it('enqueues an item as pending', async () => {
    const db = makeDb()

    const id = await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })

    const item = await db.outbox.get(id)
    expect(item).toMatchObject({ entity: 'wine', action: 'create', targetId: 1, status: 'pending', error: null })
  })

  it('replays a pending item successfully and removes it from the queue', async () => {
    const db = makeDb()
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })
    const handler: OutboxHandler = vi.fn().mockResolvedValue(undefined)

    await replay(db.outbox, { wine: handler })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('leaves a failed item visible with its error message, without touching later items', async () => {
    const db = makeDb()
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'fails' } })
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 2, payload: { name: 'succeeds' } })
    const handler: OutboxHandler = vi.fn().mockImplementation((item: OutboxItem) => {
      if (item.targetId === 1) return Promise.reject(new Error('producer no longer exists'))
      return Promise.resolve()
    })

    await replay(db.outbox, { wine: handler })

    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({ targetId: 1, status: 'failed', error: 'producer no longer exists' })
  })

  it('leaves an item pending (not failed) and stops the pass on a retryable connectivity error', async () => {
    const db = makeDb()
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 2, payload: { name: 'y' } })
    const handler: OutboxHandler = vi.fn().mockRejectedValue(new RetryableOutboxError('offline'))

    await replay(db.outbox, { wine: handler })

    expect(handler).toHaveBeenCalledTimes(1)
    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(2)
    expect(remaining.every((item) => item.status === 'pending')).toBe(true)
  })

  it('is a no-op to replay the same item twice', async () => {
    const db = makeDb()
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })
    const handler: OutboxHandler = vi.fn().mockResolvedValue(undefined)

    await replay(db.outbox, { wine: handler })
    await replay(db.outbox, { wine: handler })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  // Two local writes in quick succession each trigger their own background
  // replay pass; without claiming an item before handling it, both passes
  // would see it as still `pending` and post it twice.
  it('only lets one of two overlapping replay passes handle the same pending item', async () => {
    const db = makeDb()
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })
    let resolveHandler!: () => void
    const handler: OutboxHandler = vi.fn().mockReturnValue(new Promise<void>((r) => (resolveHandler = r)))

    const firstPass = replay(db.outbox, { wine: handler })
    const secondPass = replay(db.outbox, { wine: handler })
    resolveHandler()
    await Promise.all([firstPass, secondPass])

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('resets a failed item back to pending and clears its error', async () => {
    const db = makeDb()
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })
    await db.outbox.update(id, { status: 'failed', error: 'producer_not_found' })

    await retry(db.outbox, id)

    const item = await db.outbox.get(id)
    expect(item).toMatchObject({ status: 'pending', error: null })
  })

  it('discards an item permanently', async () => {
    const db = makeDb()
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: { name: 'x' } })

    await discard(db.outbox, id)

    expect(await db.outbox.get(id)).toBeUndefined()
  })

  describe('isQueued', () => {
    it('is true when a matching entity+targetId is still in the outbox', async () => {
      const db = makeDb()
      await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: { name: 'x' } })

      expect(await isQueued(db.outbox, 'producer', -1)).toBe(true)
      expect(await isQueued(db.outbox, 'producer', -2)).toBe(false)
      expect(await isQueued(db.outbox, 'wine', -1)).toBe(false)
    })
  })
})
