import { vi } from 'vitest'
import { ApiError, apiClient } from '../api/client'
import type {
  Appellation,
  Color,
  Consumption,
  ConsumptionHistoryEntry,
  Meal,
  Producer,
  Wine,
  WineSearchResult,
} from '../api/types'

type Named = { id: number; name: string }

interface StoredWine extends Omit<Wine, 'producer' | 'quantity'> {
  quantity: number
}

// In-memory stand-in for the HTTP API, installed behind the mocked api
// client. Just enough of the real server's behavior for gateway contract
// tests: id assignment, name-unique-agnostic CRUD, quantity bookkeeping.
export interface FakeServer {
  producers: Named[]
  appellations: Named[]
  meals: Named[]
  wines: StoredWine[]
  consumptions: Consumption[]
  pairings: { appellation_id: number; color: Color; meal_id: number }[]
  searches: string[]
  searchResults: WineSearchResult[]
  consumptionHistoryRequests: string[]
  consumptionHistory: ConsumptionHistoryEntry[]
  down: boolean
  seedProducer(name: string): Producer
  seedAppellation(name: string): Appellation
  seedMeal(name: string): Meal
  seedWine(input: Omit<StoredWine, 'id'>): Wine
}

function notFound(code: string): never {
  throw new ApiError(404, code)
}

export function installFakeServer(): FakeServer {
  let nextId = 1000
  const s: FakeServer = {
    producers: [],
    appellations: [],
    meals: [],
    wines: [],
    consumptions: [],
    pairings: [],
    searches: [],
    searchResults: [],
    consumptionHistoryRequests: [],
    consumptionHistory: [],
    down: false,
    seedProducer(name) {
      const p = { id: nextId++, name }
      s.producers.push(p)
      return p
    },
    seedAppellation(name) {
      const a = { id: nextId++, name }
      s.appellations.push(a)
      return a
    },
    seedMeal(name) {
      const m = { id: nextId++, name }
      s.meals.push(m)
      return m
    },
    seedWine(input) {
      const w = { ...input, id: nextId++ }
      s.wines.push(w)
      return toWine(w)
    },
  }

  const toWine = (w: StoredWine): Wine => {
    const producer = s.producers.find((p) => p.id === w.producer_id) ?? notFound('producer_not_found')
    return { ...w, producer }
  }
  const toDetail = (w: StoredWine) => ({
    ...toWine(w),
    suggested_meals: [] as Meal[],
    consumption_history: s.consumptions.filter((c) => c.wine_id === w.id),
  })
  const findWine = (id: number) => s.wines.find((w) => w.id === id) ?? notFound('wine_not_found')
  const idOf = (path: string) => Number(path.split('?')[0].split('/').pop())

  const named = (path: string): Named[] | null => {
    if (path.startsWith('/producers')) return s.producers
    if (path.startsWith('/appellations')) return s.appellations
    if (path.startsWith('/meals')) return s.meals
    return null
  }

  function guard(): void {
    if (s.down) throw new ApiError(0, 'Network error: unable to reach the server')
  }

  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    guard()
    const list = named(path)
    if (list) return structuredClone(list) as never
    if (path === '/wines') return s.wines.map(toWine) as never
    if (path.startsWith('/wines/')) return toDetail(findWine(idOf(path))) as never
    if (path === '/meal-pairings/all') return structuredClone(s.pairings) as never
    if (path.startsWith('/meal-pairings?')) {
      const q = new URLSearchParams(path.split('?')[1])
      const ids = s.pairings
        .filter((p) => String(p.appellation_id) === q.get('appellation_id') && p.color === q.get('color'))
        .map((p) => p.meal_id)
      return s.meals.filter((m) => ids.includes(m.id)) as never
    }
    if (path.startsWith('/search')) {
      s.searches.push(path)
      return s.searchResults as never
    }
    if (path === '/consumptions' || path.startsWith('/consumptions?')) {
      s.consumptionHistoryRequests.push(path)
      return structuredClone(s.consumptionHistory) as never
    }
    if (path === '/health') return undefined as never
    return notFound('not_found')
  })

  vi.mocked(apiClient.post).mockImplementation(async (path: string, body: unknown) => {
    guard()
    const b = body as Record<string, unknown>
    const list = named(path)
    if (list) {
      const record = { id: nextId++, name: b.name as string }
      list.push(record)
      return record as never
    }
    if (path === '/wines') {
      const { initial_quantity, client_id: _clientId, ...rest } = b
      const wine = { ...(rest as Omit<StoredWine, 'id' | 'quantity'>), id: nextId++, quantity: initial_quantity as number }
      s.wines.push(wine)
      return toWine(wine) as never
    }
    const consumption = path.match(/^\/wines\/(\d+)\/consumptions$/)
    if (consumption) {
      const wine = findWine(Number(consumption[1]))
      if (wine.quantity <= 0) throw new ApiError(409, 'quantity_zero')
      const { client_id: _clientId, ...rest } = b
      const created = { ...(rest as Omit<Consumption, 'id' | 'wine_id'>), id: nextId++, wine_id: wine.id }
      s.consumptions.push(created)
      wine.quantity -= 1
      return created as never
    }
    const adjustment = path.match(/^\/wines\/(\d+)\/quantity-adjustments$/)
    if (adjustment) {
      const wine = findWine(Number(adjustment[1]))
      const quantity = wine.quantity + (b.delta as number)
      if (quantity < 0) throw new ApiError(409, 'quantity_zero')
      wine.quantity = quantity
      return toWine(wine) as never
    }
    if (path === '/meal-pairings') {
      s.pairings.push({
        appellation_id: b.appellation_id as number,
        color: b.color as Color,
        meal_id: b.meal_id as number,
      })
      return undefined as never
    }
    return notFound('not_found')
  })

  vi.mocked(apiClient.put).mockImplementation(async (path: string, body: unknown) => {
    guard()
    const b = body as Record<string, unknown>
    const list = named(path)
    if (list) {
      const record = list.find((r) => r.id === idOf(path)) ?? notFound('not_found')
      record.name = b.name as string
      return record as never
    }
    if (path.startsWith('/wines/')) {
      const wine = findWine(idOf(path))
      Object.assign(wine, b)
      return toWine(wine) as never
    }
    if (path.startsWith('/consumptions/')) {
      const consumption = s.consumptions.find((c) => c.id === idOf(path)) ?? notFound('consumption_not_found')
      Object.assign(consumption, b)
      return consumption as never
    }
    return notFound('not_found')
  })

  vi.mocked(apiClient.delete).mockImplementation(async (path: string, body: unknown) => {
    guard()
    const list = named(path)
    if (list) {
      const index = list.findIndex((r) => r.id === idOf(path))
      if (index < 0) notFound('not_found')
      list.splice(index, 1)
      return undefined as never
    }
    if (path.startsWith('/consumptions/')) {
      const index = s.consumptions.findIndex((c) => c.id === idOf(path))
      if (index < 0) notFound('consumption_not_found')
      const [removed] = s.consumptions.splice(index, 1)
      findWine(removed.wine_id).quantity += 1
      return undefined as never
    }
    if (path === '/meal-pairings') {
      const b = body as { appellation_id: number; color: Color; meal_id: number }
      s.pairings = s.pairings.filter(
        (p) => !(p.appellation_id === b.appellation_id && p.color === b.color && p.meal_id === b.meal_id),
      )
      return undefined as never
    }
    return notFound('not_found')
  })

  return s
}
