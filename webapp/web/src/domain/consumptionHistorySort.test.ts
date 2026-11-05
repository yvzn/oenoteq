import { describe, expect, it } from 'vitest'
import {
  consumptionHistorySortAxes,
  consumptionHistorySortToQueryParams,
  defaultConsumptionHistorySort,
  nextConsumptionHistorySort,
  queryParamsToConsumptionHistorySort,
  type ConsumptionHistorySort,
} from './consumptionHistorySort'

describe('consumptionHistorySortToQueryParams', () => {
  it('omits params for the default sort', () => {
    expect(consumptionHistorySortToQueryParams(defaultConsumptionHistorySort)).toEqual({})
  })

  it('includes both params for a non-default sort', () => {
    expect(consumptionHistorySortToQueryParams({ sortBy: 'producer', sortDir: 'asc' })).toEqual({
      sort_by: 'producer',
      sort_dir: 'asc',
    })
  })

  it('includes sort_dir alone when only direction differs from default', () => {
    expect(consumptionHistorySortToQueryParams({ sortBy: 'date', sortDir: 'asc' })).toEqual({ sort_dir: 'asc' })
  })
})

describe('queryParamsToConsumptionHistorySort', () => {
  it('parses an empty query into the default sort, date descending', () => {
    expect(queryParamsToConsumptionHistorySort({})).toEqual({ sortBy: 'date', sortDir: 'desc' })
  })

  it('parses a valid sort_by/sort_dir combination', () => {
    expect(queryParamsToConsumptionHistorySort({ sort_by: 'appellation', sort_dir: 'asc' })).toEqual({
      sortBy: 'appellation',
      sortDir: 'asc',
    })
  })

  it('falls back to the default sortBy on an unknown value, including the cellar list status axis', () => {
    expect(queryParamsToConsumptionHistorySort({ sort_by: 'status' }).sortBy).toBe('date')
  })

  it('falls back to the default sortDir on an unknown value', () => {
    expect(queryParamsToConsumptionHistorySort({ sort_dir: 'sideways' }).sortDir).toBe('desc')
  })

  it('round-trips a sort through query params without loss', () => {
    const sort: ConsumptionHistorySort = { sortBy: 'millesime', sortDir: 'desc' }
    expect(queryParamsToConsumptionHistorySort(consumptionHistorySortToQueryParams(sort))).toEqual(sort)
  })
})

describe('nextConsumptionHistorySort', () => {
  it('switches to a new column at ascending', () => {
    expect(nextConsumptionHistorySort(defaultConsumptionHistorySort, 'producer')).toEqual({
      sortBy: 'producer',
      sortDir: 'asc',
    })
  })

  it('toggles direction when clicking the already-active column', () => {
    expect(nextConsumptionHistorySort({ sortBy: 'date', sortDir: 'desc' }, 'date')).toEqual({
      sortBy: 'date',
      sortDir: 'asc',
    })
    expect(nextConsumptionHistorySort({ sortBy: 'date', sortDir: 'asc' }, 'date')).toEqual({
      sortBy: 'date',
      sortDir: 'desc',
    })
  })
})

describe('consumptionHistorySortAxes', () => {
  it('lists producer, appellation, millesime and date', () => {
    expect(consumptionHistorySortAxes.map((a) => a.sortBy)).toEqual(['producer', 'appellation', 'millesime', 'date'])
  })
})
