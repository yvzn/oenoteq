export type SortBy = 'producer' | 'appellation' | 'millesime' | 'status'
export type SortDir = 'asc' | 'desc'

export interface WineSort {
  sortBy: SortBy
  sortDir: SortDir
}

export const defaultWineSort: WineSort = { sortBy: 'appellation', sortDir: 'asc' }

const sortByValues: SortBy[] = ['producer', 'appellation', 'millesime', 'status']
const sortDirValues: SortDir[] = ['asc', 'desc']

export function sortToQueryParams(sort: WineSort): Record<string, string> {
  const params: Record<string, string> = {}
  if (sort.sortBy !== defaultWineSort.sortBy) params.sort_by = sort.sortBy
  if (sort.sortDir !== defaultWineSort.sortDir) params.sort_dir = sort.sortDir
  return params
}

export function queryParamsToSort(query: Record<string, unknown>): WineSort {
  return {
    sortBy: parseSortBy(query.sort_by),
    sortDir: parseSortDir(query.sort_dir),
  }
}

// Switches to a new column at ascending, or toggles direction when the
// column clicked is already the active one.
export function nextSort(current: WineSort, sortBy: SortBy): WineSort {
  if (current.sortBy !== sortBy) return { sortBy, sortDir: 'asc' }
  return { sortBy, sortDir: current.sortDir === 'asc' ? 'desc' : 'asc' }
}

export const sortAxes: { sortBy: SortBy; label: string }[] = [
  { sortBy: 'producer', label: 'Producer' },
  { sortBy: 'appellation', label: 'Appellation' },
  { sortBy: 'millesime', label: 'Millesime' },
  { sortBy: 'status', label: 'Status' },
]

function parseSortBy(value: unknown): SortBy {
  return typeof value === 'string' && sortByValues.includes(value as SortBy)
    ? (value as SortBy)
    : defaultWineSort.sortBy
}

function parseSortDir(value: unknown): SortDir {
  return typeof value === 'string' && sortDirValues.includes(value as SortDir)
    ? (value as SortDir)
    : defaultWineSort.sortDir
}
