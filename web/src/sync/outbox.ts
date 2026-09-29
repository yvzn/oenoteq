import type { Table } from 'dexie'

export interface OutboxItem<TPayload = unknown> {
  id?: number
  entity: string
  action: 'create' | 'update'
  targetId: number | string
  payload: TPayload
  status: 'pending' | 'failed'
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
    try {
      await handler(item)
      await table.delete(item.id!)
    } catch (e) {
      if (e instanceof RetryableOutboxError) return
      await table.update(item.id!, {
        status: 'failed',
        error: e instanceof Error ? e.message : 'Sync failed',
      })
    }
  }
}
