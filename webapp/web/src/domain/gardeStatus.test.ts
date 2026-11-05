import { describe, expect, it } from 'vitest'
import { computeGardeStatus } from './gardeStatus'

const wine = { garde_debut: 2020, garde_fin: 2028 }

describe('computeGardeStatus', () => {
  it('returns too_young before the garde window', () => {
    expect(computeGardeStatus(wine, 2019)).toBe('too_young')
  })

  it('returns ready at the start boundary of the garde window', () => {
    expect(computeGardeStatus(wine, 2020)).toBe('ready')
  })

  it('returns ready strictly inside the garde window', () => {
    expect(computeGardeStatus(wine, 2024)).toBe('ready')
  })

  it('returns ready at the end boundary of the garde window', () => {
    expect(computeGardeStatus(wine, 2028)).toBe('ready')
  })

  it('returns past_peak after the garde window', () => {
    expect(computeGardeStatus(wine, 2029)).toBe('past_peak')
  })

  it('returns unassessed when both bounds are missing', () => {
    expect(computeGardeStatus({ garde_debut: null, garde_fin: null }, 2024)).toBe('unassessed')
  })

  it('computes too_young/ready from a start-only bound, never past_peak', () => {
    const startOnly = { garde_debut: 2024, garde_fin: null }
    expect(computeGardeStatus(startOnly, 2023)).toBe('too_young')
    expect(computeGardeStatus(startOnly, 2030)).toBe('ready')
  })

  it('computes ready/past_peak from an end-only bound, never too_young', () => {
    const endOnly = { garde_debut: null, garde_fin: 2024 }
    expect(computeGardeStatus(endOnly, 2020)).toBe('ready')
    expect(computeGardeStatus(endOnly, 2025)).toBe('past_peak')
  })
})
