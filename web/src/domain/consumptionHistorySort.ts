import type { SortDir } from './wineSort'

export type ConsumptionHistorySortBy = 'producer' | 'appellation' | 'millesime' | 'date'

export interface ConsumptionHistorySort {
  sortBy: ConsumptionHistorySortBy
  sortDir: SortDir
}

export const defaultConsumptionHistorySort: ConsumptionHistorySort = { sortBy: 'date', sortDir: 'desc' }

const sortByValues: ConsumptionHistorySortBy[] = ['producer', 'appellation', 'millesime', 'date']
const sortDirValues: SortDir[] = ['asc', 'desc']

export function consumptionHistorySortToQueryParams(sort: ConsumptionHistorySort): Record<string, string> {
  const params: Record<string, string> = {}
  if (sort.sortBy !== defaultConsumptionHistorySort.sortBy) params.sort_by = sort.sortBy
  if (sort.sortDir !== defaultConsumptionHistorySort.sortDir) params.sort_dir = sort.sortDir
  return params
}

export function queryParamsToConsumptionHistorySort(query: Record<string, unknown>): ConsumptionHistorySort {
  return {
    sortBy: parseSortBy(query.sort_by),
    sortDir: parseSortDir(query.sort_dir),
  }
}

// Switches to a new column at ascending, or toggles direction when the
// column clicked is already the active one, as on the cellar list.
export function nextConsumptionHistorySort(
  current: ConsumptionHistorySort,
  sortBy: ConsumptionHistorySortBy,
): ConsumptionHistorySort {
  if (current.sortBy !== sortBy) return { sortBy, sortDir: 'asc' }
  return { sortBy, sortDir: current.sortDir === 'asc' ? 'desc' : 'asc' }
}

export const consumptionHistorySortAxes: { sortBy: ConsumptionHistorySortBy }[] = [
  { sortBy: 'producer' },
  { sortBy: 'appellation' },
  { sortBy: 'millesime' },
  { sortBy: 'date' },
]

function parseSortBy(value: unknown): ConsumptionHistorySortBy {
  return typeof value === 'string' && sortByValues.includes(value as ConsumptionHistorySortBy)
    ? (value as ConsumptionHistorySortBy)
    : defaultConsumptionHistorySort.sortBy
}

function parseSortDir(value: unknown): SortDir {
  return typeof value === 'string' && sortDirValues.includes(value as SortDir)
    ? (value as SortDir)
    : defaultConsumptionHistorySort.sortDir
}
