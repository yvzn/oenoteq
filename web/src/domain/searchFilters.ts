import type { Color } from '../api/types'

export interface SearchFilters {
  mealId: number | null
  appellationId: number | null
  color: Color | null
  readyNow: boolean
}

export const emptySearchFilters: SearchFilters = {
  mealId: null,
  appellationId: null,
  color: null,
  readyNow: false,
}

export function filtersToQueryParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.mealId !== null) params.meal_id = String(filters.mealId)
  if (filters.appellationId !== null) params.appellation_id = String(filters.appellationId)
  if (filters.color !== null) params.color = filters.color
  if (filters.readyNow) params.ready_now = 'true'
  return params
}

export function queryParamsToFilters(query: Record<string, unknown>): SearchFilters {
  return {
    mealId: parseId(query.meal_id),
    appellationId: parseId(query.appellation_id),
    color: parseColor(query.color),
    readyNow: query.ready_now === 'true',
  }
}

function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}

function parseColor(value: unknown): Color | null {
  return value === 'rouge' || value === 'blanc' || value === 'rose' ? value : null
}
