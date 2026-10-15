import { describe, expect, it } from 'vitest'
import type { Color, WineDetail } from '../api/types'
import fixtures from '../../../testdata/search-fixtures.json'
import { searchLocalWines } from './localSearch'
import type { SortBy, SortDir } from './wineSort'

// The same fixtures drive the Go search tests (internal/handlers/search_fixtures_test.go).
const year = new Date().getFullYear()

const producers = fixtures.producers
const wines: WineDetail[] = fixtures.wines.map((w) => ({
  id: w.id,
  millesime: w.millesime,
  appellation_id: w.appellation_id,
  producer_id: w.producer_id,
  producer: producers.find((p) => p.id === w.producer_id)!,
  color: w.color as Color,
  garde_debut: w.garde_debut_offset === null ? null : year + w.garde_debut_offset,
  garde_fin: w.garde_fin_offset === null ? null : year + w.garde_fin_offset,
  quantity: w.quantity,
  suggested_meals: [],
  consumption_history: [],
}))
const data = {
  wines,
  producers,
  appellations: fixtures.appellations,
  pairings: fixtures.pairings.map((p) => ({
    appellationId: p.appellation_id,
    color: p.color as Color,
    mealId: p.meal_id,
  })),
}

describe('searchLocalWines against the shared search fixtures', () => {
  it.each(fixtures.cases)('$name', (c) => {
    const results = searchLocalWines(
      data,
      {
        mealId: ('meal_id' in c ? c.meal_id : null) as number | null,
        appellationId: ('appellation_id' in c ? c.appellation_id : null) as number | null,
        color: ('color' in c ? c.color : null) as Color | null,
        readyNow: 'ready_now' in c,
      },
      {
        sortBy: ('sort_by' in c ? c.sort_by : 'appellation') as SortBy,
        sortDir: ('sort_dir' in c ? c.sort_dir : 'asc') as SortDir,
      },
      year,
    )

    expect(results.map((r) => r.id)).toEqual(c.expected)
  })
})

describe('searchLocalWines results', () => {
  it('carries the Garde Status computed at read time and joined producer name', () => {
    const results = searchLocalWines(
      { ...data, producers: [{ id: 1, name: 'Renamed' }, ...producers.slice(1)] },
      { mealId: null, appellationId: 1, color: null, readyNow: false },
      { sortBy: 'producer', sortDir: 'asc' },
      year,
    )

    const first = results.find((r) => r.id === 12)
    expect(first).toMatchObject({ id: 12, garde_status: 'ready', producer: { id: 1, name: 'Renamed' } })
    expect(first).not.toHaveProperty('consumption_history')
  })
})
