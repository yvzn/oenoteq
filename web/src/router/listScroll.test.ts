import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { scrollBehavior, setCellarListRendered } from './listScroll'

const to = (name: string) => ({ name }) as RouteLocationNormalized
const from = to('wine-detail')

describe('router scroll behavior', () => {
  it('starts at the top on a fresh navigation', async () => {
    expect(await scrollBehavior(to('cellar'), from, null)).toEqual({ top: 0 })
  })

  it('restores the saved offset on the cellar list only once its results have rendered', async () => {
    setCellarListRendered(false)
    let resolved = false
    const result = Promise.resolve(scrollBehavior(to('cellar'), from, { left: 0, top: 640 })).then((r) => {
      resolved = true
      return r
    })
    await Promise.resolve()
    expect(resolved).toBe(false)

    setCellarListRendered(true)

    expect(await result).toEqual({ left: 0, top: 640 })
  })

  it('restores at once when the list is already rendered', async () => {
    setCellarListRendered(true)
    expect(await scrollBehavior(to('cellar'), from, { left: 0, top: 90 })).toEqual({ left: 0, top: 90 })
  })

  it('does not wait for the list on other pages', async () => {
    setCellarListRendered(false)
    expect(await scrollBehavior(to('wine-detail'), to('cellar'), { left: 0, top: 5 })).toEqual({ left: 0, top: 5 })
  })
})
