import type { Table } from 'dexie'
import { ApiError, apiClient } from '../api/client'
import type {
  Color,
  Consumption,
  Meal,
  Producer,
  WineDetail,
  WineInput,
  WineSearchResult,
} from '../api/types'
import { db } from '../db/localDb'
import { nextLocalId } from '../db/localId'
import { sortByName } from '../db/sortByName'
import { filtersToQueryParams } from '../domain/searchFilters'
import { sortToQueryParams } from '../domain/wineSort'
import { pushChangesInBackground } from '../sync'
import {
  enqueueAppellationCreate,
  enqueueAppellationUpdate,
  patchPendingAppellationCreate,
  pullAppellations,
} from '../sync/appellationSync'
import {
  cancelPendingConsumptionCreate,
  enqueueConsumptionCreate,
  enqueueConsumptionUpdate,
  enqueueQuantityAdjustment,
  patchPendingConsumptionCreate,
} from '../sync/consumptionSync'
import { resolveIdIfSynced } from '../sync/idRemap'
import { enqueueMealCreate, enqueueMealUpdate, patchPendingMealCreate, pullMeals } from '../sync/mealSync'
import { enqueueMealPairingAdd, pullMealPairings } from '../sync/mealPairingSync'
import {
  enqueueProducerCreate,
  enqueueProducerUpdate,
  patchPendingProducerCreate,
  pullProducers,
} from '../sync/producerSync'
import { enqueueWineCreate, enqueueWineUpdate, patchPendingWineCreate, pullWine } from '../sync/wineSync'
import type { DataGateway, NamedEntityGateway, MealPairingGateway, WineGateway } from './types'

interface NamedEntityConfig<T extends { id: number; name: string }> {
  table: Table<T, number>
  path: string
  pull: () => Promise<void>
  enqueueCreate: (localId: number, payload: { name: string; client_id: string }) => Promise<number>
  enqueueUpdate: (id: number, payload: { name: string }) => Promise<number>
  patchPendingCreate: (localId: number, payload: { name: string }) => Promise<boolean>
}

// Producers, Appellations and Meals share one shape: local store first, a
// queued create/update, delete stays an online-only server call.
function namedEntityGateway<T extends { id: number; name: string }>(
  cfg: NamedEntityConfig<T>,
): NamedEntityGateway<T> {
  return {
    async list() {
      try {
        if (navigator.onLine !== false) await cfg.pull()
        return sortByName(await cfg.table.toArray())
      } catch (e) {
        const cached = sortByName(await cfg.table.toArray())
        if (cached.length > 0) return cached
        throw e
      }
    },

    async create(name) {
      const localId = nextLocalId()
      const record = { id: localId, name } as T
      await cfg.table.put(record)
      await cfg.enqueueCreate(localId, { name, client_id: crypto.randomUUID() })
      pushChangesInBackground()
      return record
    },

    async update(id, name) {
      const record = { id, name } as T
      await cfg.table.put(record)
      const patchedPendingCreate = id < 0 && (await cfg.patchPendingCreate(id, { name }))
      if (!patchedPendingCreate) await cfg.enqueueUpdate(id, { name })
      pushChangesInBackground()
      return record
    },

    async remove(id) {
      await apiClient.delete(`${cfg.path}/${id}`, undefined)
      await cfg.table.delete(id)
    },
  }
}

function buildWineDetail(
  id: number,
  input: WineInput,
  producer: Producer,
  extras: Pick<WineDetail, 'quantity' | 'suggested_meals' | 'consumption_history'>,
): WineDetail {
  return {
    id,
    millesime: input.millesime,
    appellation_id: input.appellation_id,
    producer_id: input.producer_id,
    producer,
    color: input.color,
    garde_debut: input.garde_debut,
    garde_fin: input.garde_fin,
    ...extras,
  }
}

// The form may still hold the local id of a Producer/Appellation created
// inline whose create has since synced (and swapped to a server id) — store
// and queue the wine against the id that actually exists now.
async function resolveReferences<T extends { appellation_id: number; producer_id: number }>(
  input: T,
): Promise<T> {
  return {
    ...input,
    appellation_id: await resolveIdIfSynced(input.appellation_id),
    producer_id: await resolveIdIfSynced(input.producer_id),
  }
}

async function resolveProducer(existing: WineDetail | undefined, producerId: number): Promise<Producer> {
  if (existing && existing.producer_id === producerId) return existing.producer
  return (await db.producers.get(producerId)) ?? { id: producerId, name: '' }
}

// A negative id is local-only. If it's still in the local store, its create
// hasn't synced yet; if it's gone, the create may have already synced and
// replaced it — the idRemap breadcrumb redirects that case to the real id.
async function resolveWine(id: number): Promise<{ targetId: number; existing: WineDetail | undefined }> {
  let targetId = id
  let existing = await db.wines.get(id)
  if (!existing && id < 0) {
    const remap = await db.idRemap.get(id)
    if (remap) {
      targetId = remap.serverId
      existing = await db.wines.get(targetId)
    }
  }
  return { targetId, existing }
}

const wines: WineGateway = {
  async get(id, onCached) {
    const { targetId: resolvedId, existing: cached } = await resolveWine(id)
    if (cached) onCached?.(cached)
    // A negative id never exists at the server (its create hasn't synced).
    if (resolvedId < 0) return { wine: cached ?? null, resolvedId }
    try {
      if (navigator.onLine !== false) return { wine: await pullWine(resolvedId), resolvedId }
    } catch (e) {
      if (!cached) return { wine: null, resolvedId, error: e }
    }
    return { wine: cached ?? null, resolvedId }
  },

  async create(rawInput) {
    const input = await resolveReferences(rawInput)
    const producer = await resolveProducer(undefined, input.producer_id)
    const localId = nextLocalId()
    const record = buildWineDetail(localId, input, producer, {
      quantity: input.initial_quantity,
      suggested_meals: [],
      consumption_history: [],
    })
    await db.wines.put(record)
    await enqueueWineCreate(localId, { ...input, client_id: crypto.randomUUID() })
    pushChangesInBackground()
    return record
  },

  async update(id, rawInput) {
    const input = await resolveReferences(rawInput)
    // Defense in depth: the view layer redirects a stale negative id once
    // it notices get() resolved elsewhere, but if an update is somehow
    // submitted against a stale id anyway (a tight race), redirect it here
    // too rather than queuing a PUT against an id that no longer exists.
    const { targetId, existing } = await resolveWine(id)
    const producer = await resolveProducer(existing, input.producer_id)
    const merged = buildWineDetail(targetId, input, producer, {
      quantity: existing?.quantity ?? 0,
      suggested_meals: existing?.suggested_meals ?? [],
      consumption_history: existing?.consumption_history ?? [],
    })
    await db.wines.put(merged)

    const patchedPendingCreate = targetId < 0 && (await patchPendingWineCreate(targetId, input))
    if (!patchedPendingCreate) await enqueueWineUpdate(targetId, input)
    pushChangesInBackground()
    return merged
  },

  async adjustQuantity(id, delta) {
    const { targetId, existing } = await resolveWine(id)
    if (!existing) throw new ApiError(404, 'wine_not_found')
    const quantity = existing.quantity + delta
    if (quantity < 0) throw new ApiError(409, 'quantity_zero')
    const updated: WineDetail = { ...existing, quantity }
    await db.wines.put(updated)
    await enqueueQuantityAdjustment(targetId, { delta, client_id: crypto.randomUUID() })
    pushChangesInBackground()
    return updated
  },

  async recordConsumption(id, input) {
    const { targetId, existing } = await resolveWine(id)
    if (!existing) throw new ApiError(404, 'wine_not_found')
    if (existing.quantity <= 0) throw new ApiError(409, 'quantity_zero')
    const localId = nextLocalId()
    const consumption: Consumption = { id: localId, wine_id: targetId, ...input }
    const updated: WineDetail = {
      ...existing,
      quantity: existing.quantity - 1,
      consumption_history: [...existing.consumption_history, consumption],
    }
    await db.wines.put(updated)
    await enqueueConsumptionCreate(localId, targetId, { ...input, client_id: crypto.randomUUID() })
    pushChangesInBackground()
    return updated
  },

  async updateConsumption(wineId, consumptionId, input) {
    const existing = await db.wines.get(wineId)
    if (!existing) throw new ApiError(404, 'wine_not_found')
    const consumption_history = existing.consumption_history.map((c) =>
      c.id === consumptionId ? { ...c, ...input } : c,
    )
    await db.wines.update(wineId, { consumption_history })

    const patchedPendingCreate =
      consumptionId < 0 && (await patchPendingConsumptionCreate(consumptionId, input))
    if (!patchedPendingCreate) await enqueueConsumptionUpdate(consumptionId, input)
    pushChangesInBackground()
    return { ...existing, consumption_history }
  },

  // A consumption still sitting unsent in the outbox is simply dequeued —
  // nothing was ever pushed, so there's no server call to make. One already
  // synced (a positive id) stays the existing online-only delete.
  async deleteConsumption(wineId, consumptionId) {
    if (consumptionId < 0) {
      const canceled = await cancelPendingConsumptionCreate(consumptionId)
      if (!canceled) throw new ApiError(409, 'consumption_not_found')
      const existing = await db.wines.get(wineId)
      if (!existing) throw new ApiError(404, 'wine_not_found')
      const updated: WineDetail = {
        ...existing,
        quantity: existing.quantity + 1,
        consumption_history: existing.consumption_history.filter((c) => c.id !== consumptionId),
      }
      await db.wines.put(updated)
      return updated
    }
    await apiClient.delete(`/consumptions/${consumptionId}`, undefined)
    return (await wines.get(wineId)).wine
  },
}

async function readLocalPairing(appellationId: number, color: Color): Promise<Meal[]> {
  const records = await db.mealPairings
    .where('appellationId')
    .equals(appellationId)
    .filter((r) => r.color === color)
    .toArray()
  const meals = await Promise.all(records.map((r) => db.meals.get(r.mealId)))
  return sortByName(meals.filter((m): m is Meal => m !== undefined))
}

const mealPairings: MealPairingGateway = {
  async list(appellationId, color) {
    try {
      if (navigator.onLine !== false) return sortByName(await pullMealPairings(appellationId, color))
      return await readLocalPairing(appellationId, color)
    } catch (e) {
      const cached = await readLocalPairing(appellationId, color)
      if (cached.length > 0) return cached
      throw e
    }
  },

  async add(appellationId, color, mealId) {
    const meal = await db.meals.get(mealId)
    await db.mealPairings.put({ appellationId, color, mealId })
    await enqueueMealPairingAdd({ appellationId, color, mealId })
    pushChangesInBackground()
    return meal
  },

  // Removal stays synchronous and online-only — no outbox queueing.
  async remove(appellationId, color, mealId) {
    await apiClient.delete('/meal-pairings', { appellation_id: appellationId, color, meal_id: mealId })
    await db.mealPairings.delete([appellationId, color, mealId])
  },
}

export const localFirstGateway: DataGateway = {
  wines,
  producers: namedEntityGateway({
    table: db.producers,
    path: '/producers',
    pull: pullProducers,
    enqueueCreate: enqueueProducerCreate,
    enqueueUpdate: enqueueProducerUpdate,
    patchPendingCreate: patchPendingProducerCreate,
  }),
  appellations: namedEntityGateway({
    table: db.appellations,
    path: '/appellations',
    pull: pullAppellations,
    enqueueCreate: enqueueAppellationCreate,
    enqueueUpdate: enqueueAppellationUpdate,
    patchPendingCreate: patchPendingAppellationCreate,
  }),
  meals: namedEntityGateway({
    table: db.meals,
    path: '/meals',
    pull: pullMeals,
    enqueueCreate: enqueueMealCreate,
    enqueueUpdate: enqueueMealUpdate,
    patchPendingCreate: patchPendingMealCreate,
  }),
  mealPairings,

  // The cellar list still reads the server's search (ADR 0009 not landed).
  async search(filters, sort) {
    const query = new URLSearchParams({
      ...filtersToQueryParams(filters),
      ...sortToQueryParams(sort),
    }).toString()
    return apiClient.get<WineSearchResult[]>(query ? `/search?${query}` : '/search')
  },
}
