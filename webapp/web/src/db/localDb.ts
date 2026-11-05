import Dexie, { type Table } from 'dexie'
import type { Appellation, Color, Meal, Producer, WineDetail } from '../api/types'
import type { OutboxItem } from '../sync/outbox'

// Breadcrumb left behind when an offline-created Wine's negative local id
// gets replaced by a server-assigned one, so a view (or a stale bookmark/
// page reload) still holding the old id can resolve to the new one.
export interface IdRemap {
  localId: number
  serverId: number
}

// Local copy of every Meal Pairing edge (full sync pulls the bulk read), keyed
// so an offline `add` is reflected locally before it syncs.
export interface MealPairingRecord {
  appellationId: number
  color: Color
  mealId: number
}

// Small key/value facts about the local store itself (not synced data).
export interface MetaRecord {
  key: string
  value: string
}

// Set once the first full pull has completed: from then on an empty store is a
// genuinely empty cellar rather than one that was never downloaded.
export const FIRST_PULL_KEY = 'firstPullCompletedAt'

export class LocalDb extends Dexie {
  wines!: Table<WineDetail, number>
  producers!: Table<Producer, number>
  appellations!: Table<Appellation, number>
  outbox!: Table<OutboxItem, number>
  idRemap!: Table<IdRemap, number>
  meals!: Table<Meal, number>
  mealPairings!: Table<MealPairingRecord, [number, Color, number]>
  meta!: Table<MetaRecord, string>

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
    this.version(3).stores({
      meals: 'id',
      mealPairings: '[appellationId+color+mealId], appellationId',
    })
    // A store that already holds wines was downloaded before this marker existed.
    this.version(4)
      .stores({ meta: 'key' })
      .upgrade(async (tx) => {
        if ((await tx.table('wines').count()) > 0) {
          await tx.table('meta').put({ key: FIRST_PULL_KEY, value: new Date().toISOString() })
        }
      })
  }
}

export const db = new LocalDb()
