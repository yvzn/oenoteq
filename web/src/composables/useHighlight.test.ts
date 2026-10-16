import { afterEach, describe, expect, it } from 'vitest'
import { useHighlight } from './useHighlight'

afterEach(() => {
  useHighlight().clear()
})

describe('useHighlight', () => {
  it('accumulates highlighted keys and tolerates re-highlighting', () => {
    const h = useHighlight()

    h.highlight('quantity', 'Quantity adjusted.')
    h.highlight(['quantity', 'consumption-3'], 'Consumption recorded.')

    expect(h.isHighlighted('quantity')).toBe(true)
    expect(h.isHighlighted('consumption-3')).toBe(true)
    expect(h.announcement.value).toBe('Consumption recorded.')
  })

  it('forgets everything on clear', () => {
    const h = useHighlight()
    h.highlight('quantity', 'Quantity adjusted.')

    h.clear()

    expect(h.isHighlighted('quantity')).toBe(false)
    expect(h.announcement.value).toBeNull()
  })
})
