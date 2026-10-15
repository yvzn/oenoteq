import { describe, expect, it, vi } from 'vitest'
import { syncNow } from './index'
import { pullProducers } from './producerSync'

vi.mock('./appellationSync', () => ({ pullAppellations: vi.fn(), pushAppellations: vi.fn() }))
vi.mock('./consumptionSync', () => ({ pushConsumptions: vi.fn() }))
vi.mock('./mealPairingSync', () => ({ pullAllMealPairings: vi.fn(async () => {}), pushMealPairings: vi.fn() }))
vi.mock('./mealSync', () => ({ pullMeals: vi.fn(), pushMeals: vi.fn() }))
vi.mock('./producerSync', () => ({ pullProducers: vi.fn(), pushProducers: vi.fn() }))
vi.mock('./wineSync', () => ({ pullWines: vi.fn(), pushWines: vi.fn() }))

describe('syncNow', () => {
  it('reports progress after each step, ending at total', async () => {
    const progress: Array<[number, number]> = []
    await syncNow((done, total) => progress.push([done, total]))
    const total = progress[0][1]
    expect(progress.map(([done]) => done)).toEqual(Array.from({ length: total }, (_, i) => i + 1))
  })

  it('rejects when a step fails, without reporting further progress', async () => {
    vi.mocked(pullProducers).mockRejectedValueOnce(new Error('offline'))
    const onProgress = vi.fn()
    await expect(syncNow(onProgress)).rejects.toThrow('offline')
    expect(onProgress).toHaveBeenCalledTimes(1) // the push step only
  })
})
