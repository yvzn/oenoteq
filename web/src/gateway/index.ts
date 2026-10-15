import { readConsent } from '../consent/storageConsent'
import { directGateway } from './directGateway'
import { localFirstGateway } from './localFirstGateway'
import type { DataGateway } from './types'

// The one place the data path is chosen (ADR 0010): the local-first adapter
// only with granted Storage Consent, the direct-to-server one otherwise
// (refused, or no choice yet). The record is read on every call — it is a
// synchronous local read — so no screen can hold on to a stale choice.
function active(): DataGateway {
  return readConsent() === 'granted' ? localFirstGateway : directGateway
}

export const gateway: DataGateway = {
  wines: {
    get: (id, onCached) => active().wines.get(id, onCached),
    create: (input) => active().wines.create(input),
    update: (id, input) => active().wines.update(id, input),
    adjustQuantity: (id, delta) => active().wines.adjustQuantity(id, delta),
    recordConsumption: (wineId, input) => active().wines.recordConsumption(wineId, input),
    updateConsumption: (wineId, consumptionId, input) =>
      active().wines.updateConsumption(wineId, consumptionId, input),
    deleteConsumption: (wineId, consumptionId) => active().wines.deleteConsumption(wineId, consumptionId),
  },
  producers: {
    list: () => active().producers.list(),
    create: (name) => active().producers.create(name),
    update: (id, name) => active().producers.update(id, name),
    remove: (id) => active().producers.remove(id),
  },
  appellations: {
    list: () => active().appellations.list(),
    create: (name) => active().appellations.create(name),
    update: (id, name) => active().appellations.update(id, name),
    remove: (id) => active().appellations.remove(id),
  },
  meals: {
    list: () => active().meals.list(),
    create: (name) => active().meals.create(name),
    update: (id, name) => active().meals.update(id, name),
    remove: (id) => active().meals.remove(id),
  },
  mealPairings: {
    list: (appellationId, color) => active().mealPairings.list(appellationId, color),
    add: (appellationId, color, mealId) => active().mealPairings.add(appellationId, color, mealId),
    remove: (appellationId, color, mealId) => active().mealPairings.remove(appellationId, color, mealId),
  },
  search: (filters, sort) => active().search(filters, sort),
}

export type { ConsumptionInput, DataGateway } from './types'
