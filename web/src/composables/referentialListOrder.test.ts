import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { useAppellations } from './useAppellations'
import { useMealPairings } from './useMealPairings'
import { useMeals } from './useMeals'
import { useProducers } from './useProducers'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.unstubAllGlobals()
})

// Ids deliberately out of name order; 'Émile' checks binary (code-point)
// ordering: accented letters sort after all ASCII, as in SQLite BINARY.
const unsorted = [
  { id: 1, name: 'Zeta' },
  { id: 2, name: 'Émile' },
  { id: 3, name: 'alpha' },
  { id: 4, name: 'Beta' },
]
const sortedNames = ['Beta', 'Zeta', 'alpha', 'Émile']

const lists = [
  { label: 'appellations', table: db.appellations, use: () => { const c = useAppellations(); return { ...c, items: c.appellations } } },
  { label: 'producers', table: db.producers, use: () => { const c = useProducers(); return { ...c, items: c.producers } } },
  { label: 'meals', table: db.meals, use: () => { const c = useMeals(); return { ...c, items: c.meals } } },
]

describe.each(lists)('$label list order', ({ table, use }) => {
  it('is name-ascending when loaded online', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(unsorted)
    const { items, load } = use()
    await load()
    expect(items.value.map((r) => r.name)).toEqual(sortedNames)
  })

  it('is name-ascending when loaded offline from the local store', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await table.bulkPut(unsorted)
    const { items, load } = use()
    await load()
    expect(items.value.map((r) => r.name)).toEqual(sortedNames)
  })

  it('puts a locally created (negative id) record at its alphabetical position', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await table.bulkPut(unsorted)
    const { items, load, create } = use()
    await create('Gamma')
    await load()
    expect(items.value.map((r) => r.name)).toEqual(['Beta', 'Gamma', 'Zeta', 'alpha', 'Émile'])
  })

  it('keeps order in memory right after create, without reload', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await table.bulkPut(unsorted)
    const { items, load, create } = use()
    await load()
    await create('Gamma')
    expect(items.value.map((r) => r.name)).toEqual(['Beta', 'Gamma', 'Zeta', 'alpha', 'Émile'])
  })
})

describe('meal pairing list order', () => {
  it('is name-ascending when read offline from the local store', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await db.meals.bulkPut(unsorted)
    await db.mealPairings.bulkPut(unsorted.map((m) => ({ appellationId: 9, color: 'rouge' as const, mealId: m.id })))
    const { meals, load } = useMealPairings()
    await load(9, 'rouge')
    expect(meals.value.map((m) => m.name)).toEqual(sortedNames)
  })

  it('is name-ascending when pulled online', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(unsorted)
    const { meals, load } = useMealPairings()
    await load(9, 'rouge')
    expect(meals.value.map((m) => m.name)).toEqual(sortedNames)
  })

  it('inserts an added pairing at its alphabetical position', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await db.meals.bulkPut(unsorted)
    await db.mealPairings.bulkPut([
      { appellationId: 9, color: 'rouge', mealId: 1 },
      { appellationId: 9, color: 'rouge', mealId: 4 },
    ])
    const { meals, load, add } = useMealPairings()
    await load(9, 'rouge')
    await add(9, 'rouge', 3)
    expect(meals.value.map((m) => m.name)).toEqual(['Beta', 'Zeta', 'alpha'])
  })
})
