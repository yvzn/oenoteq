import type { Table } from 'dexie'

// Fire-and-forget cache write for a reference list (Appellation/Producer):
// these are a read-through convenience for offline display, never the
// source of truth, so a write failure here shouldn't surface to the caller.
export function cacheAll<T>(table: Table<T, number>, items: T[]): void {
  table.bulkPut(items).catch(() => {})
}

export function cacheOne<T>(table: Table<T, number>, item: T): void {
  table.put(item).catch(() => {})
}

export function uncache(table: Table<unknown, number>, id: number): void {
  table.delete(id).catch(() => {})
}
