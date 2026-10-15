import type { Appellation, Color, GardeStatus, Producer, WineDetail, WineSearchResult } from '../api/types'
import type { MealPairingRecord } from '../db/localDb'
import { computeGardeStatus } from './gardeStatus'
import type { SearchFilters } from './searchFilters'
import type { WineSort } from './wineSort'

export interface LocalSearchData {
  wines: WineDetail[]
  producers: Producer[]
  appellations: Appellation[]
  pairings: MealPairingRecord[]
}

// Glossary order of Garde Status (CONTEXT.md).
const statusRank: Record<GardeStatus, number> = { too_young: 0, ready: 1, past_peak: 2, unassessed: 3 }

// Plain code-unit comparison, like the server's binary ordering (see sortByName).
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// A value that is absent always sorts after every present one, whatever the direction.
function compareNullsLast(a: number | null, b: number | null, sign: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return (a - b) * sign
}

type Row = { wine: WineSearchResult; appellationName: string }

function comparator(sort: WineSort): (a: Row, b: Row) => number {
  const sign = sort.sortDir === 'asc' ? 1 : -1
  const byProducerThenId = (a: Row, b: Row) =>
    compareText(a.wine.producer.name, b.wine.producer.name) || a.wine.id - b.wine.id

  switch (sort.sortBy) {
    case 'producer':
      return (a, b) => compareText(a.wine.producer.name, b.wine.producer.name) * sign || a.wine.id - b.wine.id
    case 'appellation':
      return (a, b) => compareText(a.appellationName, b.appellationName) * sign || byProducerThenId(a, b)
    case 'millesime':
      return (a, b) => compareNullsLast(a.wine.millesime, b.wine.millesime, sign) || byProducerThenId(a, b)
    case 'status':
      return (a, b) =>
        (statusRank[a.wine.garde_status] - statusRank[b.wine.garde_status]) * sign ||
        compareNullsLast(a.wine.garde_debut, b.wine.garde_debut, sign) ||
        byProducerThenId(a, b)
  }
}

// The server's search (`SearchWines`), run over the local copy: only wines in
// stock, filters ANDed, Garde Status computed now, names joined from the local
// reference data. Must stay in step with the Go implementation — both are
// proven against testdata/search-fixtures.json.
export function searchLocalWines(
  data: LocalSearchData,
  filters: SearchFilters,
  sort: WineSort,
  currentYear: number = new Date().getFullYear(),
): WineSearchResult[] {
  const producerById = new Map(data.producers.map((p) => [p.id, p]))
  const appellationNameById = new Map(data.appellations.map((a) => [a.id, a.name]))
  const pairedWith = (appellationId: number, color: Color, mealId: number) =>
    data.pairings.some((p) => p.appellationId === appellationId && p.color === color && p.mealId === mealId)

  const rows: Row[] = []
  for (const w of data.wines) {
    if (w.quantity <= 0) continue
    if (filters.appellationId !== null && w.appellation_id !== filters.appellationId) continue
    if (filters.color !== null && w.color !== filters.color) continue
    if (filters.mealId !== null && !pairedWith(w.appellation_id, w.color, filters.mealId)) continue
    const garde_status = computeGardeStatus(w, currentYear)
    if (filters.readyNow && garde_status !== 'ready') continue
    rows.push({
      appellationName: appellationNameById.get(w.appellation_id) ?? '',
      wine: {
        id: w.id,
        millesime: w.millesime,
        appellation_id: w.appellation_id,
        producer_id: w.producer_id,
        producer: producerById.get(w.producer_id) ?? w.producer,
        color: w.color,
        garde_debut: w.garde_debut,
        garde_fin: w.garde_fin,
        quantity: w.quantity,
        garde_status,
      },
    })
  }
  return rows.sort(comparator(sort)).map((r) => r.wine)
}
