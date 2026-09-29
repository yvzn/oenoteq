import Dexie, { type Table } from 'dexie'
import type { Appellation, Producer, WineDetail } from '../api/types'
import type { OutboxItem } from '../sync/outbox'

export class LocalDb extends Dexie {
  wines!: Table<WineDetail, number>
  producers!: Table<Producer, number>
  appellations!: Table<Appellation, number>
  outbox!: Table<OutboxItem, number>

  constructor(name = 'cellar') {
    super(name)
    this.version(1).stores({
      wines: 'id',
      producers: 'id',
      appellations: 'id',
      outbox: '++id, status, entity',
    })
  }
}

export const db = new LocalDb()
