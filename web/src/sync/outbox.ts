import type { Table } from 'dexie'

export interface OutboxItem<TPayload = unknown> {
  id?: number
  entity: string
  action: 'create' | 'update'
  targetId: number | string
  payload: TPayload
  status: 'pending' | 'in-flight' | 'failed'
  error: string | null
  createdAt: string
}

export type OutboxHandler = (item: OutboxItem) => Promise<void>

// A handler throws this to signal a transient connectivity problem (as
// opposed to a server-rejected item) — the item stays `pending` so the next
// reconnect retries it silently, and the rest of this replay pass is
// abandoned since further items would hit the same outage.
export class RetryableOutboxError extends Error {}

export async function enqueue(
  table: Table<OutboxItem, number>,
  item: Pick<OutboxItem, 'entity' | 'action' | 'targetId' | 'payload'>,
): Promise<number> {
  return table.add({ ...item, status: 'pending', error: null, createdAt: new Date().toISOString() })
}

// Two independent local writes (e.g. creating a Meal, then immediately
// pairing it) can each trigger their own background replay pass, racing
// each other over the same outbox table. A plain read-then-write isn't
// enough to keep them from both picking up the same pending item, so the
// claim itself runs inside a transaction: only the scan that actually flips
// `pending` -> `in-flight` gets to handle the item, and a `false` result
// tells the other scan to skip it.
async function claim(table: Table<OutboxItem, number>, id: number): Promise<boolean> {
  return table.db.transaction('rw', table, async () => {
    const current = await table.get(id)
    if (!current || current.status !== 'pending') return false
    await table.update(id, { status: 'in-flight' })
    return true
  })
}

// Replays every pending item in FIFO order against the handler registered for
// its entity. A failing item is marked `failed` with its error and left in
// place so it doesn't block independent items later in the queue; it's then
// excluded from future replays until something (a manual retry) resets it
// back to `pending`.
export async function replay(
  table: Table<OutboxItem, number>,
  handlers: Record<string, OutboxHandler>,
): Promise<void> {
  const items = await table.where('status').equals('pending').sortBy('id')
  for (const item of items) {
    const handler = handlers[item.entity]
    if (!handler) continue
    if (!(await claim(table, item.id!))) continue
    try {
      await handler(item)
      await table.delete(item.id!)
    } catch (e) {
      if (e instanceof RetryableOutboxError) {
        await table.update(item.id!, { status: 'pending' })
        return
      }
      await table.update(item.id!, {
        status: 'failed',
        error: e instanceof Error ? e.message : 'Sync failed',
      })
    }
  }
}
