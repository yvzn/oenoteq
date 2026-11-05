import { apiClient } from '../api/client'
import type { Color, Meal, WineDetail } from '../api/types'
import { sortByName } from '../db/sortByName'
import { serverConsumptionHistory } from './serverConsumptionHistory'
import { serverSearch } from './serverSearch'
import type { DataGateway, MealPairingGateway, NamedEntityGateway, WineGateway } from './types'

// Online-only adapter (Storage Consent refused): every call goes straight to
// the server and fails with the underlying error when it can't be reached. No
// local store, outbox, client-side ids or pending state — ids are always the
// server's, and what a call resolves with is what the server holds.

function namedEntityGateway<T extends { id: number; name: string }>(path: string): NamedEntityGateway<T> {
  return {
    async list() {
      return sortByName(await apiClient.get<T[]>(path))
    },
    create: (name) => apiClient.post<T>(path, { name, client_id: crypto.randomUUID() }),
    update: (id, name) => apiClient.put<T>(`${path}/${id}`, { name }),
    async remove(id) {
      await apiClient.delete(`${path}/${id}`, undefined)
    },
  }
}

const getDetail = (id: number) => apiClient.get<WineDetail>(`/wines/${id}`)

const wines: WineGateway = {
  async get(id) {
    try {
      return { wine: await getDetail(id), resolvedId: id }
    } catch (e) {
      return { wine: null, resolvedId: id, error: e }
    }
  },

  async create(input) {
    const created = await apiClient.post<{ id: number }>('/wines', { ...input, client_id: crypto.randomUUID() })
    return getDetail(created.id)
  },

  async update(id, input) {
    await apiClient.put(`/wines/${id}`, input)
    return getDetail(id)
  },

  async adjustQuantity(id, delta) {
    await apiClient.post(`/wines/${id}/quantity-adjustments`, { delta, client_id: crypto.randomUUID() })
    return getDetail(id)
  },

  async recordConsumption(wineId, input) {
    await apiClient.post(`/wines/${wineId}/consumptions`, { ...input, client_id: crypto.randomUUID() })
    return getDetail(wineId)
  },

  async updateConsumption(wineId, consumptionId, input) {
    await apiClient.put(`/consumptions/${consumptionId}`, input)
    return getDetail(wineId)
  },

  async deleteConsumption(wineId, consumptionId) {
    await apiClient.delete(`/consumptions/${consumptionId}`, undefined)
    return getDetail(wineId).catch(() => null)
  },
}

async function listPairing(appellationId: number, color: Color): Promise<Meal[]> {
  const query = new URLSearchParams({ appellation_id: String(appellationId), color })
  return sortByName(await apiClient.get<Meal[]>(`/meal-pairings?${query}`))
}

const mealPairings: MealPairingGateway = {
  list: listPairing,

  async add(appellationId, color, mealId) {
    await apiClient.post('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
    // The add itself succeeded; failing to read the meal back only costs the immediate display.
    const paired = await listPairing(appellationId, color).catch(() => [])
    return paired.find((m) => m.id === mealId)
  },

  async remove(appellationId, color, mealId) {
    await apiClient.delete('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
  },
}

export const directGateway: DataGateway = {
  wines,
  producers: namedEntityGateway('/producers'),
  appellations: namedEntityGateway('/appellations'),
  meals: namedEntityGateway('/meals'),
  mealPairings,
  search: serverSearch,

  watchSearch(filters, sort, onResult, onError) {
    let active = true
    serverSearch(filters, sort).then(
      (results) => active && onResult(results),
      (e: unknown) => active && onError(e),
    )
    return () => {
      active = false
    }
  },

  consumptionHistory: serverConsumptionHistory,
}
