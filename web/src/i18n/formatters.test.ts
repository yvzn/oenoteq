import { describe, expect, it } from 'vitest'
import { formatDate, formatYear } from './formatters'

describe('formatDate', () => {
  it('writes the date the way each language writes it', () => {
    expect(formatDate('2026-03-12', 'en')).toBe('12 March 2026')
    expect(formatDate('2026-03-12', 'fr')).toBe('12 mars 2026')
  })
})

describe('formatYear', () => {
  it('never inserts digit grouping', () => {
    expect(formatYear(2018, 'en')).toBe('2018')
    expect(formatYear(2018, 'fr')).toBe('2018')
    expect(formatYear(12345, 'fr')).toBe('12345')
  })
})
