import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, pageToQueryParams, paginate, parsePage } from './pagination'

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('paginate', () => {
  it('takes 10 items per page, page 2 continuing where page 1 ends', () => {
    expect(PAGE_SIZE).toBe(10)
    expect(paginate(items(25), 1).items).toEqual(items(10))
    expect(paginate(items(25), 2).items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(paginate(items(25), 3).items).toEqual([21, 22, 23, 24, 25])
  })

  it('reports total and page count', () => {
    const p = paginate(items(25), 1)
    expect(p.total).toBe(25)
    expect(p.pageCount).toBe(3)
  })

  it('clamps a page beyond the last to the last page', () => {
    const p = paginate(items(25), 99)
    expect(p.page).toBe(3)
    expect(p.items).toEqual([21, 22, 23, 24, 25])
  })

  it('has one page for an empty or short list', () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 })
    expect(paginate(items(10), 1).pageCount).toBe(1)
    expect(paginate(items(11), 1).pageCount).toBe(2)
  })
})

describe('parsePage', () => {
  it('reads a positive integer', () => {
    expect(parsePage('3')).toBe(3)
  })

  it.each([undefined, '', 'abc', '0', '-2', '1.5', ['2'], null])('means page 1 for %j', (v) => {
    expect(parsePage(v)).toBe(1)
  })
})

describe('pageToQueryParams', () => {
  it('omits page 1 and keeps others', () => {
    expect(pageToQueryParams(1)).toEqual({})
    expect(pageToQueryParams(3)).toEqual({ page: '3' })
  })
})
