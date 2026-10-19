import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { WineCreateInput } from '../api/types'
import { defaultConsumptionHistorySort } from '../domain/consumptionHistorySort'
import type { FakeServer } from '../test/fakeServer'
import type { DataGateway } from './types'

export interface GatewayHarness {
  gateway: DataGateway
  server: FakeServer
  // Waits until every background effect of earlier calls (queued pushes in
  // the local-first adapter) has landed, so the next step starts from rest.
  settle(): Promise<void>
}

// Contract every DataGateway adapter must satisfy. It only talks to the
// gateway and a fake server, so it holds for local-first and direct alike.
//
// Where adapters legitimately differ the contract is deliberately silent and
// each adapter's own test file states the difference:
//  - ids returned by create may be client-side local ids until synced, so the
//    contract treats ids as opaque and only ever feeds them back to the gateway;
//  - the server may not hold a record the instant create resolves (outbox),
//    so server state is only asserted after `settle()`;
//  - "pending / not yet synced" state exists only for local-first;
//  - the direct adapter has no local copy: it never falls back to one, and a
//    write fails outright (rather than queueing) when the server can't be reached.
//    `settle()` is a no-op there because every write has landed when it resolves.
export function describeGatewayContract(name: string, setup: () => GatewayHarness): void {
  describe(`DataGateway contract — ${name}`, () => {
    const wineInput = (producerId: number, appellationId: number): WineCreateInput => ({
      millesime: 2018,
      appellation_id: appellationId,
      producer_id: producerId,
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
      initial_quantity: 3,
    })

    // After settling, an adapter may have swapped a client-side id for the
    // real one, so callers re-read a record to get the id that is current.
    async function freshWine(h: GatewayHarness, id: number) {
      return (await h.gateway.wines.get(id)).wine!
    }

    async function seedReferences(h: GatewayHarness) {
      const producer = await h.gateway.producers.create('Les Garillères')
      const appellation = await h.gateway.appellations.create('Margaux')
      await h.settle()
      return { producer, appellation }
    }

    async function createWine(h: GatewayHarness) {
      const { producer, appellation } = await seedReferences(h)
      const wine = await h.gateway.wines.create(wineInput(producer.id, appellation.id))
      await h.settle()
      return wine
    }

    describe.each([
      ['producers', (h: GatewayHarness) => h.gateway.producers, (h: GatewayHarness) => h.server.seedProducer],
      ['appellations', (h: GatewayHarness) => h.gateway.appellations, (h: GatewayHarness) => h.server.seedAppellation],
      ['meals', (h: GatewayHarness) => h.gateway.meals, (h: GatewayHarness) => h.server.seedMeal],
    ] as const)('%s', (_label, gatewayOf, seedOf) => {
      it('lists server records sorted by name', async () => {
        const h = setup()
        seedOf(h).call(h.server, 'Zeta')
        seedOf(h).call(h.server, 'Alpha')

        const list = await gatewayOf(h).list()

        expect(list.map((r) => r.name)).toEqual(['Alpha', 'Zeta'])
      })

      it('creates a record that then shows in the list and reaches the server', async () => {
        const h = setup()

        const created = await gatewayOf(h).create('Nouveau')
        await h.settle()

        expect(created.name).toBe('Nouveau')
        expect((await gatewayOf(h).list()).map((r) => r.name)).toEqual(['Nouveau'])
        const serverNames = [...h.server.producers, ...h.server.appellations, ...h.server.meals].map((r) => r.name)
        expect(serverNames).toEqual(['Nouveau'])
      })

      it('updates a record', async () => {
        const h = setup()
        await gatewayOf(h).create('Avant')
        await h.settle()
        const [created] = await gatewayOf(h).list()

        const updated = await gatewayOf(h).update(created.id, 'Après')
        await h.settle()

        expect(updated.name).toBe('Après')
        expect((await gatewayOf(h).list()).map((r) => r.name)).toEqual(['Après'])
        const serverNames = [...h.server.producers, ...h.server.appellations, ...h.server.meals].map((r) => r.name)
        expect(serverNames).toEqual(['Après'])
      })

      it('removes a record', async () => {
        const h = setup()
        await gatewayOf(h).create('Temp')
        await h.settle()
        const [created] = await gatewayOf(h).list()

        await gatewayOf(h).remove(created.id)

        expect(await gatewayOf(h).list()).toEqual([])
        expect([...h.server.producers, ...h.server.appellations, ...h.server.meals]).toEqual([])
      })

      it('surfaces a server rejection as a friendly error', async () => {
        const h = setup()
        await gatewayOf(h).create('Temp')
        await h.settle()
        const [created] = await gatewayOf(h).list()
        await gatewayOf(h).remove(created.id)

        const failure = await gatewayOf(h).remove(created.id).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
      })

      it('rejects listing with a friendly error when the server is unreachable and nothing is cached', async () => {
        const h = setup()
        h.server.down = true

        const failure = await gatewayOf(h).list().catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
        expect(friendlyErrorMessage(failure)).toContain('unable to reach the server')
      })
    })

    describe('wines', () => {
      it('creates a wine with its initial quantity and reads it back', async () => {
        const h = setup()
        const created = await createWine(h)

        const { wine, resolvedId } = await h.gateway.wines.get(created.id)

        expect(created.quantity).toBe(3)
        expect(wine).toMatchObject({ millesime: 2018, color: 'rouge', quantity: 3, producer: { name: 'Les Garillères' } })
        expect(resolvedId).toBe(wine?.id)
        expect(h.server.wines).toHaveLength(1)
        expect(h.server.wines[0]).toMatchObject({ millesime: 2018, quantity: 3 })
      })

      it('updates a wine', async () => {
        const h = setup()
        const created = await createWine(h)

        const updated = await h.gateway.wines.update(created.id, {
          millesime: 2019,
          appellation_id: created.appellation_id,
          producer_id: created.producer_id,
          color: 'blanc',
          garde_debut: null,
          garde_fin: null,
        })
        await h.settle()

        expect(updated).toMatchObject({ millesime: 2019, color: 'blanc', quantity: 3 })
        expect((await h.gateway.wines.get(created.id)).wine).toMatchObject({ millesime: 2019, color: 'blanc' })
        expect(h.server.wines[0]).toMatchObject({ millesime: 2019, color: 'blanc' })
      })

      it('reports a missing wine as an error, still giving back the id', async () => {
        const h = setup()

        const result = await h.gateway.wines.get(987654)

        expect(result.wine).toBeNull()
        expect(result.resolvedId).toBe(987654)
        expect(friendlyErrorMessage(result.error)).toContain('wine')
      })

      it('adjusts quantity', async () => {
        const h = setup()
        const created = await createWine(h)

        const up = await h.gateway.wines.adjustQuantity(created.id, 2)
        const down = await h.gateway.wines.adjustQuantity(created.id, -4)
        await h.settle()

        expect(up.quantity).toBe(5)
        expect(down.quantity).toBe(1)
        expect(h.server.wines[0].quantity).toBe(1)
      })

      it('refuses to adjust below zero with a friendly error', async () => {
        const h = setup()
        const created = await createWine(h)

        const failure = await h.gateway.wines.adjustQuantity(created.id, -4).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
        expect(friendlyErrorMessage(failure)).toContain('nothing left')
      })

      it('refuses to adjust an unknown wine with a friendly error', async () => {
        const h = setup()

        const failure = await h.gateway.wines.adjustQuantity(987654, 1).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
        expect(friendlyErrorMessage(failure)).toContain('find that wine')
      })

      it('records a consumption: quantity drops and it joins the history', async () => {
        const h = setup()
        const created = await createWine(h)

        const after = await h.gateway.wines.recordConsumption(created.id, {
          date: '2026-01-02',
          rating: 4,
          notes: 'good',
        })
        await h.settle()

        expect(after.quantity).toBe(2)
        expect(after.consumption_history).toHaveLength(1)
        expect(after.consumption_history[0]).toMatchObject({ date: '2026-01-02', rating: 4, notes: 'good' })
        expect(h.server.consumptions).toHaveLength(1)
        expect(h.server.wines[0].quantity).toBe(2)
      })

      it('refuses a consumption when nothing is left', async () => {
        const h = setup()
        const created = await createWine(h)
        await h.gateway.wines.adjustQuantity(created.id, -3)
        await h.settle()

        const failure = await h.gateway.wines
          .recordConsumption(created.id, { date: '2026-01-02', rating: null, notes: null })
          .catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
        expect(friendlyErrorMessage(failure)).toContain('nothing left')
      })

      it('updates a consumption', async () => {
        const h = setup()
        const created = await createWine(h)
        const recorded = await h.gateway.wines.recordConsumption(created.id, {
          date: '2026-01-02',
          rating: 4,
          notes: null,
        })
        await h.settle()
        const loaded = await freshWine(h, created.id)
        const consumptionId = loaded.consumption_history[0].id

        const updated = await h.gateway.wines.updateConsumption(loaded.id, consumptionId, {
          date: '2026-02-03',
          rating: 5,
          notes: 'better',
        })
        await h.settle()

        expect(recorded.consumption_history).toHaveLength(1)
        expect(updated.consumption_history).toHaveLength(1)
        expect(updated.consumption_history[0]).toMatchObject({ date: '2026-02-03', rating: 5, notes: 'better' })
        expect(h.server.consumptions[0]).toMatchObject({ date: '2026-02-03', rating: 5, notes: 'better' })
      })

      it('deletes a consumption and gives the bottle back', async () => {
        const h = setup()
        const created = await createWine(h)
        await h.gateway.wines.recordConsumption(created.id, { date: '2026-01-02', rating: null, notes: null })
        await h.settle()
        const loaded = await freshWine(h, created.id)

        const after = await h.gateway.wines.deleteConsumption(loaded.id, loaded.consumption_history[0].id)
        await h.settle()

        expect(after).toMatchObject({ quantity: 3, consumption_history: [] })
        expect(h.server.consumptions).toEqual([])
        expect(h.server.wines[0].quantity).toBe(3)
      })

      it('rejects deleting an unknown consumption with a friendly error', async () => {
        const h = setup()
        const created = await createWine(h)

        const failure = await h.gateway.wines.deleteConsumption(created.id, 987654).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
        expect(friendlyErrorMessage(failure)).toContain('consumption entry')
      })
    })

    describe('meal pairings', () => {
      it('adds, lists and removes a pairing', async () => {
        const h = setup()
        await h.gateway.appellations.create('Margaux')
        await h.gateway.meals.create('Boeuf')
        await h.settle()
        const [appellation] = await h.gateway.appellations.list()
        const [meal] = await h.gateway.meals.list()

        const added = await h.gateway.mealPairings.add(appellation.id, 'rouge', meal.id)
        await h.settle()

        expect(added).toMatchObject({ name: 'Boeuf' })
        expect(h.server.pairings).toHaveLength(1)
        expect((await h.gateway.mealPairings.list(appellation.id, 'rouge')).map((m) => m.name)).toEqual(['Boeuf'])
        expect(await h.gateway.mealPairings.list(appellation.id, 'blanc')).toEqual([])

        await h.gateway.mealPairings.remove(appellation.id, 'rouge', meal.id)

        expect(h.server.pairings).toEqual([])
        expect(await h.gateway.mealPairings.list(appellation.id, 'rouge')).toEqual([])
      })

      it('lists pairings sorted by meal name', async () => {
        const h = setup()
        await h.gateway.appellations.create('Margaux')
        await h.gateway.meals.create('Zeta')
        await h.gateway.meals.create('Alpha')
        await h.settle()
        const [appellation] = await h.gateway.appellations.list()
        const [alpha, zeta] = await h.gateway.meals.list()
        await h.gateway.mealPairings.add(appellation.id, 'rouge', zeta.id)
        await h.gateway.mealPairings.add(appellation.id, 'rouge', alpha.id)
        await h.settle()

        const meals = await h.gateway.mealPairings.list(appellation.id, 'rouge')

        expect(meals.map((m) => m.name)).toEqual(['Alpha', 'Zeta'])
      })

      it('rejects listing with an error when the server is unreachable and nothing is cached', async () => {
        const h = setup()
        h.server.down = true

        const failure = await h.gateway.mealPairings.list(1, 'rouge').catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
      })
    })

    describe('consumption history', () => {
      it("returns the server's consumption history", async () => {
        const h = setup()
        h.server.consumptionHistory = [
          {
            id: 7,
            wine_id: 3,
            date: '2026-02-01',
            producer: { id: 2, name: 'Les Vignerons' },
            appellation_id: 5,
            color: 'rouge',
            millesime: 2018,
          },
        ]

        const history = await h.gateway.consumptionHistory(defaultConsumptionHistorySort)

        expect(history).toEqual(h.server.consumptionHistory)
        expect(h.server.consumptionHistoryRequests).toEqual(['/consumptions'])
      })

      it('asks the server for the requested sort', async () => {
        const h = setup()

        await h.gateway.consumptionHistory({ sortBy: 'producer', sortDir: 'asc' })

        expect(h.server.consumptionHistoryRequests).toEqual(['/consumptions?sort_by=producer&sort_dir=asc'])
      })

      it('rejects with an error when the server is unreachable', async () => {
        const h = setup()
        h.server.down = true

        const failure = await h.gateway.consumptionHistory(defaultConsumptionHistorySort).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ApiError)
      })
    })
  })
}
