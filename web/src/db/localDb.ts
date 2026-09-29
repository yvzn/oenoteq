import Dexie, { type Table } from 'dexie'
import type { Appellation, Producer, WineDetail } from '../api/types'
import type { OutboxItem } from '../sync/outbox'

// Breadcrumb left behind when an offline-created Wine's negative local id
// gets replaced by a server-assigned one, so a view (or a stale bookmark/
// page reload) still holding the old id can resolve to the new one.
export interface IdRemap {
  localId: number
  serverId: number
}

export class LocalDb extends Dexie {
  wines!: Table<WineDetail, number>
  producers!: Table<Producer, number>
  appellations!: Table<Appellation, number>
  outbox!: Table<OutboxItem, number>
  idRemap!: Table<IdRemap, number>

  constructor(name = 'cellar') {
    super(name)
    this.version(1).stores({
      wines: 'id',
      producers: 'id',
      appellations: 'id',
      outbox: '++id, status, entity',
    })
    this.version(2).stores({
      idRemap: 'localId',
    })
  }
}

export const db = new LocalDb()
