import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import type { WineSearchResult } from '../api/types'
import { db } from '../db/localDb'
import { defaultConsent, itOfflineOnly, itOnlineOnly } from '../test/consent'
import { setTestLocale } from '../test/i18n'
import CellarListView from './CellarListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

const currentYear = new Date().getFullYear()

const searchResults: WineSearchResult[] = [
  {
    id: 1,
    millesime: 2018,
    appellation_id: 1,
    producer_id: 1,
    producer: { id: 1, name: 'Les Garillères' },
    color: 'rouge',
    garde_debut: currentYear - 5,
    garde_fin: currentYear + 5,
    quantity: 3,
    garde_status: 'ready',
  },
  {
    id: 2,
    millesime: null,
    appellation_id: 2,
    producer_id: 2,
    producer: { id: 2, name: 'Domaine X' },
    color: 'blanc',
    garde_debut: currentYear + 1,
    garde_fin: currentYear + 10,
    quantity: 1,
    garde_status: 'too_young',
  },
]

const appellations = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
]

const meals = [{ id: 1, name: 'Boeuf bourguignon' }]

// Serves the cellar the way the active adapter reads it: the server's search
// when online-only, the local store (as a pull would have left it) in Offline Mode.
async function mockApi(overrides: { search?: WineSearchResult[] } = {}) {
  const wines = overrides.search ?? searchResults
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(appellations)
    if (path === '/meals') return Promise.resolve(meals)
    if (path.startsWith('/search')) return Promise.resolve(wines)
    throw new Error(`unexpected path: ${path}`)
  })
  if (defaultConsent === 'granted') await seedLocalCellar(wines)
}

// Online-only mode asks the server's search; Offline Mode never does (ADR 0009, 0010).
function expectSearchRequest(path: string) {
  const searches = vi.mocked(apiClient.get).mock.calls.map(([p]) => String(p)).filter((p) => p.startsWith('/search'))
  if (defaultConsent === 'refused') expect(searches.at(-1)).toBe(path)
  else expect(searches).toEqual([])
}

async function seedLocalCellar(wines: WineSearchResult[]) {
  await db.appellations.bulkPut(appellations)
  await db.producers.bulkPut(wines.map((w) => w.producer))
  await db.wines.bulkPut(
    wines.map(({ garde_status: _status, ...wine }) => ({ ...wine, suggested_meals: [], consumption_history: [] })),
  )
}

async function mountAt(initialPath: string, { flush = true }: { flush?: boolean } = {}) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: CellarListView },
      { path: '/wines/new', name: 'wine-new', component: CellarListView },
      { path: '/wines/:id', name: 'wine-detail', component: CellarListView },
    ],
  })
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(CellarListView, { global: { plugins: [router] } })
  if (flush) await flushPromises()
  else await wrapper.vm.$nextTick()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('CellarListView', () => {
  it('shows a loading indicator before the fetches resolve', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}))

    const { wrapper } = await mountAt('/', { flush: false })

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
  })

  it('searches with no filters and renders one item per result with garde badge', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/')

    expectSearchRequest('/search')

    const items = wrapper.findAll('[data-testid="wine-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Les Garillères')
    expect(items[0]!.text()).toContain('Chinon')
    expect(items[0]!.text()).toContain('Ready')
    expect(items[1]!.text()).toContain('Domaine X')
    expect(items[1]!.text()).toContain('Too young')
  })

  it('links each wine item to its detail view', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/')

    const links = wrapper.findAll('[data-testid="wine-link"]')
    expect(links).toHaveLength(2)
    expect(links[0]!.attributes('href')).toBe('/wines/1')
    expect(links[1]!.attributes('href')).toBe('/wines/2')
  })

  it('links to the add-wine form', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('[data-testid="add-wine-link"]').attributes('href')).toBe('/wines/new')
  })

  it('shows an error state distinct from loading when a fetch fails', async () => {
    vi.mocked(apiClient.get).mockImplementation(() => {
      return Promise.reject(new Error('server exploded'))
    })

    const { wrapper } = await mountAt('/')

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation(() => {
      return Promise.reject(new Error('server exploded'))
    })

    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await mockApi()
    await wrapper.get('[data-testid="cellar-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(true)
  })

  it('shows an empty-state message when the filters match no wines', async () => {
    await mockApi({ search: [] })

    const { wrapper } = await mountAt('/')

    expect(wrapper.text()).toContain('No wines match these filters.')
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('does not flash the empty state while still loading', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}))

    const { wrapper } = await mountAt('/', { flush: false })

    expect(wrapper.text()).not.toContain('No wines match these filters.')
  })

  it('pre-applies filters from the URL query params on load', async () => {
    await mockApi()

    await mountAt('/?appellation_id=1&color=rouge&ready_now=true')

    expectSearchRequest('/search?appellation_id=1&color=rouge&ready_now=true')
  })

  it('combines filter changes from the filter bar with AND semantics and reflects them in the URL', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.find('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()
    await wrapper.find('[data-testid="ready-now-filter"]').setValue(true)
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rouge', ready_now: 'true' })
    expectSearchRequest('/search?color=rouge&ready_now=true')
  })

  it('moves between prior filter states on browser back', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.find('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()

    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expectSearchRequest('/search')
  })

  it('labels the millesime column "Millesime", not "Vintage"', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/')

    expect(wrapper.text()).toContain('Millesime')
    expect(wrapper.text()).not.toContain('Vintage')
  })

  it('shows an ascending indicator on the appellation header by default', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('[data-testid="sort-header-appellation"]').text()).toContain('↑')
    expect(wrapper.find('[data-testid="sort-header-producer"]').text()).not.toMatch(/[↑↓]/)
  })

  it('pre-applies sort from the URL query params on load', async () => {
    await mockApi()

    await mountAt('/?sort_by=producer&sort_dir=desc')

    expectSearchRequest('/search?sort_by=producer&sort_dir=desc')
  })

  it('sorts by clicking a column header and reflects it in the URL', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer' })
    expectSearchRequest('/search?sort_by=producer')
    expect(wrapper.get('[data-testid="sort-header-producer"]').text()).toContain('↑')
  })

  it('toggles direction when clicking the already-active column header', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/?sort_by=producer')

    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer', sort_dir: 'desc' })
    expect(wrapper.get('[data-testid="sort-header-producer"]').text()).toContain('↓')
  })

  it('changes sort from the mobile sort panel and reflects it in the URL', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.get('[data-testid="sort-toggle-button"]').trigger('click')
    await wrapper.get('[data-testid="sort-axis-status"]').setValue(true)
    await wrapper.get('[data-testid="sort-direction-asc"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'status' })
    expectSearchRequest('/search?sort_by=status')
  })
})

describe('CellarListView pagination', () => {
  beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const manyWines = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...searchResults[0]!,
      id: i + 1,
      producer_id: i + 1,
      producer: { id: i + 1, name: `Producer ${String(i + 1).padStart(2, '0')}` },
    }))

  const ids = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
    wrapper.findAll('[data-testid="wine-link"]').map((l) => l.attributes('href'))

  it('shows 10 wines per page, page 2 continuing where page 1 ends', { timeout: 20000 }, async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/')
    expect(ids(wrapper)).toEqual(Array.from({ length: 10 }, (_, i) => `/wines/${i + 1}`))

    const { wrapper: page2 } = await mountAt('/?page=2')
    expect(ids(page2)).toEqual(Array.from({ length: 10 }, (_, i) => `/wines/${i + 11}`))
  })

  it('shows Page N of M with Previous disabled on the first page', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 of 3')
    expect(wrapper.get('[data-testid="pagination-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="pagination-next"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Next on the last page', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/?page=3')

    expect(wrapper.get('[data-testid="pagination-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="pagination-previous"]').attributes('disabled')).toBeUndefined()
  })

  it('hides the controls when everything fits on one page', async () => {
    await mockApi({ search: manyWines(10) })

    const { wrapper } = await mountAt('/')

    expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(false)
  })

  it('puts the page in the address on Next and Previous without refetching', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper, router } = await mountAt('/')
    vi.mocked(apiClient.get).mockClear()

    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 2 of 3')
    expect(apiClient.get).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="pagination-previous"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('keeps filters and sort next to the page param', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper, router } = await mountAt('/?color=rouge&sort_by=producer')
    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rouge', sort_by: 'producer', page: '2' })
  })

  it('restores the page when going back from a wine detail', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper, router } = await mountAt('/?page=2')
    await router.push('/wines/11')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 2 of 3')
  })

  it('resets to page 1 when a filter changes', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper, router } = await mountAt('/?page=2')
    await wrapper.find('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rouge' })
  })

  it('resets to page 1 when the sort changes', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper, router } = await mountAt('/?page=2')
    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer' })
  })

  it('clamps a page beyond the last to the last page', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/?page=99')

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 3 of 3')
    expect(wrapper.findAll('[data-testid="wine-item"]')).toHaveLength(5)
  })

  it.each(['abc', '0', '-1', ''])('treats page=%j as page 1', async (value) => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt(`/?page=${value}`)

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 of 3')
  })

  it('shows the total number of matching wines in the title, not the page count', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/?page=3')

    expect(wrapper.text()).toContain('25 wines in cellar')
  })

  itOnlineOnly('slices in the order the server result arrives (sorted before sliced)', async () => {
    await mockApi({ search: manyWines(25).reverse() })

    const { wrapper } = await mountAt('/')

    expect(ids(wrapper)[0]).toBe('/wines/25')
    expect(ids(wrapper)[9]).toBe('/wines/16')
  })

  itOfflineOnly('sorts the whole local result before slicing, so page 2 continues where page 1 ends', async () => {
    await mockApi({ search: manyWines(25) })

    const { wrapper } = await mountAt('/?sort_by=producer&sort_dir=desc')
    const page1 = ids(wrapper)
    const { wrapper: second } = await mountAt('/?sort_by=producer&sort_dir=desc&page=2')

    expect(page1).toEqual(Array.from({ length: 10 }, (_, i) => `/wines/${25 - i}`))
    expect(ids(second)).toEqual(Array.from({ length: 10 }, (_, i) => `/wines/${15 - i}`))
  }, 20000)

  it('scrolls to the top when the page changes', async () => {
    await mockApi({ search: manyWines(25) })
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    const { wrapper } = await mountAt('/')
    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('scrolls to the top on browser back to another page', async () => {
    await mockApi({ search: manyWines(25) })
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)

    const { router } = await mountAt('/?page=2')
    expect(scrollTo).not.toHaveBeenCalled()
    await router.push('/')
    await flushPromises()
    scrollTo.mockClear()
    await router.back()
    await flushPromises()

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('renders the controls in French', async () => {
    await mockApi({ search: manyWines(25) })
    setTestLocale('fr')

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 sur 3')
    expect(wrapper.get('[data-testid="pagination-next"]').text()).toBe('Suivant')
  })
})

// The local-store read/write path chains several Dexie/IndexedDB
// operations (each a macrotask under fake-indexeddb), so a couple of
// ticks isn't always enough to observe it settle.
async function flushPromises() {
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
