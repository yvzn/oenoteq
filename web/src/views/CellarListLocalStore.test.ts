import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient } from '../api/client'
import type { WineDetail, WineInput } from '../api/types'
import { db } from '../db/localDb'
import { gateway } from '../gateway'
import { syncNow } from '../sync'
import { pullWines } from '../sync/wineSync'
import { itOfflineOnly } from '../test/consent'
import { installFakeServer, type FakeServer } from '../test/fakeServer'
import CellarListView from './CellarListView.vue'

// Offline Mode: the cellar list is the local copy, whatever the network does (ADR 0009).
vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const year = new Date().getFullYear()
let server: FakeServer

beforeEach(() => {
  server = installFakeServer()
})

afterEach(async () => {
  // Let queued pushes finish before the shared local store is cleared.
  await new Promise((r) => setTimeout(r, 50))
  for (const m of [apiClient.get, apiClient.post, apiClient.put, apiClient.delete]) vi.mocked(m).mockReset()
})

function localWine(over: Partial<WineDetail> & Pick<WineDetail, 'id'>): WineDetail {
  return {
    millesime: 2018,
    appellation_id: 1,
    producer_id: 1,
    producer: { id: 1, name: 'Domaine A' },
    color: 'rouge',
    garde_debut: year - 2,
    garde_fin: year + 2,
    quantity: 2,
    suggested_meals: [],
    consumption_history: [],
    ...over,
  }
}

async function seedLocal(...wines: WineDetail[]) {
  await db.producers.bulkPut([
    { id: 1, name: 'Domaine A' },
    { id: 2, name: 'Domaine B' },
  ])
  await db.appellations.bulkPut([
    { id: 1, name: 'Chinon' },
    { id: 2, name: 'Sancerre' },
  ])
  // The filter bar's meal options; a synced device always has its meals.
  await db.meals.put({ id: 1, name: 'Boeuf' })
  await db.wines.bulkPut(wines)
}

type Wrapper = ReturnType<typeof mount>

async function mountList(path = '/'): Promise<Wrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: CellarListView },
      { path: '/wines/new', name: 'wine-new', component: CellarListView },
      { path: '/wines/:id', name: 'wine-detail', component: CellarListView },
    ],
  })
  router.push(path)
  await router.isReady()
  const wrapper = mount(CellarListView, { global: { plugins: [router] } })
  await settle()
  return wrapper
}

const hrefs = (w: Wrapper) => w.findAll('[data-testid="wine-link"]').map((l) => l.attributes('href'))
const listText = (w: Wrapper) => w.get('[data-testid="wine-list"]').text()

// Each Dexie/IndexedDB step is a macrotask under fake-indexeddb.
async function settle() {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

const input = (over: Partial<WineInput> = {}): WineInput => ({
  millesime: 2018,
  appellation_id: 1,
  producer_id: 1,
  color: 'rouge',
  garde_debut: year - 2,
  garde_fin: year + 2,
  ...over,
})

describe('CellarListView in Offline Mode', () => {
  itOfflineOnly('lists the local copy without calling the search endpoint, even with no network', async () => {
    await seedLocal(localWine({ id: 5 }), localWine({ id: 6, quantity: 0 }))
    server.down = true

    const wrapper = await mountList()

    expect(hrefs(wrapper)).toEqual(['/wines/5'])
    expect(server.searches).toEqual([])
    expect(wrapper.text()).toContain('1 wine in cellar')
  })

  itOfflineOnly('filters, sorts and shows Garde Status from the local copy', async () => {
    await seedLocal(
      localWine({ id: 1, appellation_id: 1, color: 'rouge' }),
      localWine({ id: 2, appellation_id: 2, color: 'blanc', garde_debut: year + 3, garde_fin: year + 9 }),
      localWine({ id: 3, appellation_id: 2, color: 'rouge', garde_debut: null, garde_fin: null }),
    )
    server.down = true

    expect(hrefs(await mountList('/?appellation_id=2'))).toEqual(['/wines/2', '/wines/3'])
    expect(hrefs(await mountList('/?color=rouge&sort_by=status&sort_dir=desc'))).toEqual(['/wines/3', '/wines/1'])
    // "ready now" never matches an unassessed wine
    expect(hrefs(await mountList('/?ready_now=true'))).toEqual(['/wines/1'])
    expect(listText(await mountList('/?sort_by=status'))).toContain('Too young')
  })

  itOfflineOnly('shows a wine created offline right away, without navigating', async () => {
    await seedLocal(localWine({ id: 5 }))
    server.down = true
    const wrapper = await mountList()

    const created = await gateway.wines.create({ ...input({ producer_id: 2, appellation_id: 2 }), initial_quantity: 3 })
    await settle()

    expect(created.id).toBeLessThan(0)
    expect(hrefs(wrapper)).toContain(`/wines/${created.id}`)
    expect(wrapper.text()).toContain('2 wines in cellar')
  })

  itOfflineOnly('drops a wine as soon as its last bottle is consumed offline', async () => {
    await seedLocal(localWine({ id: 5, quantity: 1 }), localWine({ id: 6 }))
    server.down = true
    const wrapper = await mountList()
    expect(hrefs(wrapper)).toEqual(['/wines/5', '/wines/6'])

    await gateway.wines.recordConsumption(5, { date: '2026-01-01', rating: null, notes: null })
    await settle()

    expect(hrefs(wrapper)).toEqual(['/wines/6'])
  })

  itOfflineOnly('shows a bottle count adjusted offline at once', async () => {
    await seedLocal(localWine({ id: 5, quantity: 2 }))
    server.down = true
    const wrapper = await mountList()

    await gateway.wines.adjustQuantity(5, 4)
    await settle()

    expect(listText(wrapper)).toContain('×6')
  })

  itOfflineOnly('shows a queued edit in the list', async () => {
    await seedLocal(localWine({ id: 5, garde_debut: year - 2, garde_fin: year + 2 }))
    server.down = true
    const wrapper = await mountList()
    expect(listText(wrapper)).toContain('Ready')

    await gateway.wines.update(5, input({ garde_debut: year + 4, garde_fin: year + 8 }))
    await settle()

    expect(listText(wrapper)).toContain('Too young')
    expect(listText(wrapper)).not.toContain('Ready')
  })

  itOfflineOnly('keeps a wine with an unsent change when an older server copy is pulled', async () => {
    const producer = server.seedProducer('Domaine A')
    const appellation = server.seedAppellation('Chinon')
    const stale = server.seedWine({
      millesime: 2018,
      appellation_id: appellation.id,
      producer_id: producer.id,
      color: 'rouge',
      garde_debut: year - 2,
      garde_fin: year + 2,
      quantity: 2,
    })
    await db.producers.put(producer)
    await db.appellations.put(appellation)
    await db.meals.put({ id: 1, name: 'Boeuf' })
    await db.wines.put({ ...stale, suggested_meals: [], consumption_history: [] })
    server.down = true
    const wrapper = await mountList()
    await gateway.wines.update(
      stale.id,
      input({ appellation_id: appellation.id, producer_id: producer.id, garde_debut: year + 4, garde_fin: year + 8 }),
    )
    server.down = false

    await pullWines()
    await settle()

    expect(listText(wrapper)).toContain('Too young')

    // Once the edit has synced, the next pull converges on the server's state.
    await syncNow()
    server.wines.find((w) => w.id === stale.id)!.garde_debut = year - 1
    server.wines.find((w) => w.id === stale.id)!.garde_fin = year + 1
    await pullWines()
    await settle()

    expect(listText(wrapper)).toContain('Ready')
  })

  itOfflineOnly('filters by meal for an appellation and color never opened on this device', async () => {
    await seedLocal(
      localWine({ id: 1, appellation_id: 1, color: 'rouge' }),
      localWine({ id: 2, appellation_id: 2, color: 'blanc' }),
    )
    // As the full sync left them: pairings for combinations no one ever visited.
    await db.meals.put({ id: 9, name: 'Oysters' })
    await db.mealPairings.put({ appellationId: 2, color: 'blanc', mealId: 9 })
    server.down = true

    const wrapper = await mountList('/?meal_id=9')

    expect(hrefs(wrapper)).toEqual(['/wines/2'])
    expect(server.searches).toEqual([])
  })
})
