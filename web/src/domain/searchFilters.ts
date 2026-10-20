import type { Color } from '../api/types'

// The filters every filter bar offers; pages add their own on top.
export interface CommonFilters {
  mealId: number | null
  appellationId: number | null
  color: Color | null
}

export const emptyCommonFilters: CommonFilters = {
  mealId: null,
  appellationId: null,
  color: null,
}

// What a page's extra filters get to render against, live inline or as the mobile panel's draft.
export interface ExtraFiltersScope<F extends CommonFilters> {
  filters: F
  update: (patch: Partial<F>) => void
  testidSuffix: string
  inline: boolean
}

export interface SearchFilters extends CommonFilters {
  readyNow: boolean
}

export const emptySearchFilters: SearchFilters = {
  mealId: null,
  appellationId: null,
  color: null,
  readyNow: false,
}

export function commonFiltersToQueryParams(filters: CommonFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.mealId !== null) params.meal_id = String(filters.mealId)
  if (filters.appellationId !== null) params.appellation_id = String(filters.appellationId)
  if (filters.color !== null) params.color = filters.color
  return params
}

export function queryParamsToCommonFilters(query: Record<string, unknown>): CommonFilters {
  return {
    mealId: parseId(query.meal_id),
    appellationId: parseId(query.appellation_id),
    color: parseColor(query.color),
  }
}

export function filtersToQueryParams(filters: SearchFilters): Record<string, string> {
  const params = commonFiltersToQueryParams(filters)
  if (filters.readyNow) params.ready_now = 'true'
  return params
}

export function queryParamsToFilters(query: Record<string, unknown>): SearchFilters {
  return {
    ...queryParamsToCommonFilters(query),
    readyNow: query.ready_now === 'true',
  }
}

export function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}

export function parseColor(value: unknown): Color | null {
  return value === 'rouge' || value === 'blanc' || value === 'rose' ? value : null
}
