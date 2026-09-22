import { describe, expect, it } from 'vitest'
import { emptySearchFilters, filtersToQueryParams, queryParamsToFilters } from './searchFilters'

describe('filtersToQueryParams', () => {
  it('omits params for an empty filter set', () => {
    expect(filtersToQueryParams(emptySearchFilters)).toEqual({})
  })

  it('combines meal, appellation, color and ready_now params together (AND semantics)', () => {
    expect(
      filtersToQueryParams({ mealId: 1, appellationId: 2, color: 'rouge', readyNow: true }),
    ).toEqual({
      meal_id: '1',
      appellation_id: '2',
      color: 'rouge',
      ready_now: 'true',
    })
  })

  it('omits ready_now when false', () => {
    expect(
      filtersToQueryParams({ mealId: null, appellationId: null, color: null, readyNow: false }),
    ).toEqual({})
  })
})

describe('queryParamsToFilters', () => {
  it('parses an empty query into empty filters', () => {
    expect(queryParamsToFilters({})).toEqual(emptySearchFilters)
  })

  it('parses all filters combined from a query object', () => {
    expect(
      queryParamsToFilters({
        meal_id: '1',
        appellation_id: '2',
        color: 'blanc',
        ready_now: 'true',
      }),
    ).toEqual({ mealId: 1, appellationId: 2, color: 'blanc', readyNow: true })
  })

  it('ignores a non-numeric id', () => {
    expect(queryParamsToFilters({ meal_id: 'abc' }).mealId).toBeNull()
  })

  it('ignores an invalid color', () => {
    expect(queryParamsToFilters({ color: 'purple' }).color).toBeNull()
  })

  it('treats ready_now as false unless exactly "true"', () => {
    expect(queryParamsToFilters({ ready_now: 'yes' }).readyNow).toBe(false)
  })

  it('round-trips filters through query params without loss', () => {
    const filters = { mealId: 3, appellationId: 4, color: 'rose' as const, readyNow: true }
    expect(queryParamsToFilters(filtersToQueryParams(filters))).toEqual(filters)
  })
})
