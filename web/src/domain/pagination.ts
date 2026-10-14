export const PAGE_SIZE = 10

export interface Page<T> {
  items: T[]
  page: number
  pageCount: number
  total: number
}

// Slices the full (already filtered and sorted) list, so it works for any
// list source. A page past the end clamps to the last page.
export function paginate<T>(all: T[], requestedPage: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const start = (page - 1) * PAGE_SIZE
  return { items: all.slice(start, start + PAGE_SIZE), page, pageCount, total: all.length }
}

export function parsePage(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return page >= 1 ? page : 1
}

export function pageToQueryParams(page: number): Record<string, string> {
  return page > 1 ? { page: String(page) } : {}
}
