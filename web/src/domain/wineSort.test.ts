import { describe, expect, it } from 'vitest'
import {
  defaultWineSort,
  nextSort,
  queryParamsToSort,
  sortToQueryParams,
  type WineSort,
} from './wineSort'

describe('sortToQueryParams', () => {
  it('omits params for the default sort', () => {
    expect(sortToQueryParams(defaultWineSort)).toEqual({})
  })

  it('includes both params for a non-default sort', () => {
    expect(sortToQueryParams({ sortBy: 'producer', sortDir: 'desc' })).toEqual({
      sort_by: 'producer',
      sort_dir: 'desc',
    })
  })

  it('includes sort_dir alone when only direction differs from default', () => {
    expect(sortToQueryParams({ sortBy: 'appellation', sortDir: 'desc' })).toEqual({
      sort_dir: 'desc',
    })
  })
})

describe('queryParamsToSort', () => {
  it('parses an empty query into the default sort', () => {
    expect(queryParamsToSort({})).toEqual(defaultWineSort)
  })

  it('parses a valid sort_by/sort_dir combination', () => {
    expect(queryParamsToSort({ sort_by: 'status', sort_dir: 'desc' })).toEqual({
      sortBy: 'status',
      sortDir: 'desc',
    })
  })

  it('falls back to the default sortBy on an unknown value', () => {
    expect(queryParamsToSort({ sort_by: 'quantity' }).sortBy).toBe('appellation')
  })

  it('falls back to the default sortDir on an unknown value', () => {
    expect(queryParamsToSort({ sort_dir: 'sideways' }).sortDir).toBe('asc')
  })

  it('round-trips a sort through query params without loss', () => {
    const sort: WineSort = { sortBy: 'millesime', sortDir: 'desc' }
    expect(queryParamsToSort(sortToQueryParams(sort))).toEqual(sort)
  })
})

describe('nextSort', () => {
  it('switches to a new column at ascending by default', () => {
    expect(nextSort(defaultWineSort, 'producer')).toEqual({ sortBy: 'producer', sortDir: 'asc' })
  })

  it('toggles direction when clicking the already-active column', () => {
    expect(nextSort({ sortBy: 'producer', sortDir: 'asc' }, 'producer')).toEqual({
      sortBy: 'producer',
      sortDir: 'desc',
    })
    expect(nextSort({ sortBy: 'producer', sortDir: 'desc' }, 'producer')).toEqual({
      sortBy: 'producer',
      sortDir: 'asc',
    })
  })
})
