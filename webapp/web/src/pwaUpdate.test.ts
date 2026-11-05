import { describe, expect, it, vi } from 'vitest'
import { db } from './db/localDb'
import { enqueue } from './sync/outbox'
import { handleNeedRefresh } from './pwaUpdate'

describe('handleNeedRefresh', () => {
  it('applies the update when the outbox is empty', async () => {
    const apply = vi.fn()

    await handleNeedRefresh(apply)

    expect(apply).toHaveBeenCalledOnce()
  })

  it('defers the update while an item is pending', async () => {
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: {} })
    const apply = vi.fn()

    await handleNeedRefresh(apply)

    expect(apply).not.toHaveBeenCalled()
  })

  it('defers the update while an item has failed', async () => {
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'x' })
    const apply = vi.fn()

    await handleNeedRefresh(apply)

    expect(apply).not.toHaveBeenCalled()
  })

  it('applies on a later open once the outbox has drained', async () => {
    const id = await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: 1, payload: {} })
    const apply = vi.fn()
    await handleNeedRefresh(apply)

    await db.outbox.delete(id)
    await handleNeedRefresh(apply)

    expect(apply).toHaveBeenCalledOnce()
  })
})
