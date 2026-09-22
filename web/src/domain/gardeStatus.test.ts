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
})
