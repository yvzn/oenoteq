import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized, type Router } from 'vue-router'
import { ApiError, apiClient } from '../api/client'
import type { ConsumptionHistoryEntry } from '../api/types'
import { db } from '../db/localDb'
import { scrollBehavior } from '../router/listScroll'
import { defaultConsent, itOfflineOnly } from '../test/consent'
import { setTestLocale } from '../test/i18n'
import ConsumptionHistoryView from './ConsumptionHistoryView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

const route = (name: string) => ({ name }) as RouteLocationNormalized

const history: ConsumptionHistoryEntry[] = [
  {
    id: 12,
    wine_id: 1,
    date: '2026-03-12',
    producer: { id: 1, name: 'Les Garillères' },
    appellation_id: 1,
    color: 'rouge',
    millesime: 2018,
  },
  {
    id: 11,
    wine_id: 2,
    date: '2026-01-05',
    producer: { id: 2, name: 'Domaine X' },
    appellation_id: 2,
    color: 'blanc',
    millesime: null,
  },
]

const appellations = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
]

const meals = [{ id: 7, name: 'Oysters' }]

function manyEntries(count: number): ConsumptionHistoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: count - i,
    wine_id: count - i,
    date: '2026-01-01',
    producer: { id: 1, name: 'Les Garillères' },
    appellation_id: 1,
    color: 'rouge' as const,
    millesime: 2018,
  }))
}

// The page always asks the server, whatever the consent; appellation names come
// from the active adapter as usual (the local store in Offline Mode).
async function mockApi(overrides: { history?: ConsumptionHistoryEntry[] } = {}) {
  const entries = overrides.history ?? history
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(appellations)
    if (path === '/meals') return Promise.resolve(meals)
    if (path === '/consumptions' || path.startsWith('/consumptions?')) return Promise.resolve(entries)
    throw new Error(`unexpected path: ${path}`)
  })
  await seedFilterOptions()
}

async function mockServerUnreachable() {
  vi.mocked(apiClient.get).mockRejectedValue(new ApiError(0, 'Network error: unable to reach the server'))
  await seedFilterOptions()
}

async function seedFilterOptions() {
  if (defaultConsent !== 'granted') return
  await db.appellations.bulkPut(appellations)
  await db.meals.bulkPut(meals)
}

function historyRequests() {
  return vi.mocked(apiClient.get).mock.calls.map(([p]) => String(p)).filter((p) => p.startsWith('/consumptions'))
}

async function mountAt(initialPath: string, { flush = true }: { flush?: boolean } = {}) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/history', name: 'history', component: ConsumptionHistoryView },
      { path: '/wines/:id', name: 'wine-detail', component: ConsumptionHistoryView },
    ],
  })
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(ConsumptionHistoryView, { global: { plugins: [router] } })
  if (flush) await flushPromises()
  else await wrapper.vm.$nextTick()
  return { wrapper, router }
}

const links = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid="consumption-link"]').map((l) => l.attributes('href'))

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('ConsumptionHistoryView', () => {
  it('shows a loading indicator before the history arrives', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}))

    const { wrapper } = await mountAt('/history', { flush: false })

    expect(wrapper.find('[role="status"]').text()).toContain('Loading your consumption history…')
    expect(wrapper.find('[data-testid="consumption-list"]').exists()).toBe(false)
  })

  it('asks the server and renders one row per consumption, newest first as received', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    expect(historyRequests()).toEqual(['/consumptions'])
    const items = wrapper.findAll('[data-testid="consumption-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Les Garillères')
    expect(items[0]!.text()).toContain('Red · Chinon')
    expect(items[0]!.text()).toContain('2018')
    expect(items[0]!.text()).toContain('12 March 2026')
    expect(items[1]!.text()).toContain('Domaine X')
    expect(items[1]!.text()).toContain('White · Sancerre')
    expect(items[1]!.text()).toContain('NV')
    expect(items[1]!.text()).toContain('5 January 2026')
  })

  it('shows millesime · date under the name for mobile', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    expect(wrapper.get('[data-testid="consumption-item-mobile-meta"]').text()).toBe('2018 · 12 March 2026')
  })

  it("links each row to its wine's detail page, including a wine drunk twice", async () => {
    await mockApi({ history: [...history, { ...history[0]!, id: 10, date: '2025-12-24' }] })

    const { wrapper } = await mountAt('/history')

    expect(links(wrapper)).toEqual(['/wines/1', '/wines/2', '/wines/1'])
  })

  it('shows the total number of consumptions in the title', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('2 consumptions')
  })

  it('says so when no consumption has been recorded yet', async () => {
    await mockApi({ history: [] })

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('No consumption recorded yet')
    expect(wrapper.find('[data-testid="consumption-list"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it("shows the can't-reach-the-server status line when the server is unreachable", async () => {
    await mockServerUnreachable()

    const { wrapper } = await mountAt('/history')

    expect(wrapper.get('[role="alert"]').text()).toContain('unable to reach the server')
    expect(wrapper.find('[data-testid="consumption-list"]').exists()).toBe(false)
  })

  itOfflineOnly('never falls back to consumptions held in the local store', async () => {
    await db.producers.put({ id: 1, name: 'Les Garillères' })
    await db.wines.put({
      id: 1,
      millesime: 2018,
      appellation_id: 1,
      producer_id: 1,
      producer: { id: 1, name: 'Les Garillères' },
      color: 'rouge',
      garde_debut: null,
      garde_fin: null,
      quantity: 0,
      suggested_meals: [],
      consumption_history: [{ id: 1, wine_id: 1, date: '2026-01-02', rating: null, notes: null }],
    })
    await mockServerUnreachable()

    const { wrapper } = await mountAt('/history')

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="consumption-item"]').exists()).toBe(false)
  })

  it('retries and shows the history once the server answers', async () => {
    await mockServerUnreachable()
    const { wrapper } = await mountAt('/history')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await mockApi()
    await wrapper.get('[data-testid="history-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="consumption-item"]')).toHaveLength(2)
  })
})

describe('ConsumptionHistoryView sort', () => {
  // Sorting restarts the load, which hides the header until the request settles.
  async function waitForHeader(wrapper: ReturnType<typeof mount>) {
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[data-testid="sort-header-date"]').exists()).toBe(true))
  }

  it('offers producer, appellation, vintage and date column headers as sort buttons', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    expect(wrapper.get('[data-testid="sort-header-producer"]').text()).toContain('Producer')
    expect(wrapper.get('[data-testid="sort-header-appellation"]').text()).toContain('Appellation')
    expect(wrapper.get('[data-testid="sort-header-millesime"]').text()).toContain('Vintage')
    expect(wrapper.get('[data-testid="sort-header-date"]').text()).toContain('Date')
  })

  it('sorts by date descending by default, with the indicator on the date header', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    expect(historyRequests()).toEqual(['/consumptions'])
    expect(wrapper.get('[data-testid="sort-header-date"]').text()).toContain('↓')
    expect(wrapper.get('[data-testid="sort-header-producer"]').text()).not.toMatch(/[↑↓]/)
  })

  it('pre-applies sort from the URL query params on load', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history?sort_by=appellation&sort_dir=asc')

    expect(historyRequests()).toEqual(['/consumptions?sort_by=appellation&sort_dir=asc'])
    expect(wrapper.get('[data-testid="sort-header-appellation"]').text()).toContain('↑')
  })

  it('sorts by clicking a column header and reflects it in the URL and the request', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await waitForHeader(wrapper)

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer', sort_dir: 'asc' })
    expect(historyRequests()).toEqual(['/consumptions', '/consumptions?sort_by=producer&sort_dir=asc'])
    expect(wrapper.get('[data-testid="sort-header-producer"]').text()).toContain('↑')
  })

  it('toggles direction when clicking the already-active column header', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="sort-header-date"]').trigger('click')
    await waitForHeader(wrapper)

    expect(router.currentRoute.value.query).toEqual({ sort_dir: 'asc' })
    expect(historyRequests()).toEqual(['/consumptions', '/consumptions?sort_dir=asc'])
    expect(wrapper.get('[data-testid="sort-header-date"]').text()).toContain('↑')
  })

  it('lists producer, appellation, vintage and date in the mobile sort panel', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    const axes = wrapper.get('[data-testid="sort-panel"]').findAll('label').map((l) => l.text())
    expect(axes).toEqual(['Producer', 'Appellation', 'Vintage', 'Consumption date'])
    expect(wrapper.find('[data-testid="ready-now-filter"]').exists()).toBe(false)
  })

  it('changes sort from the mobile sort panel and reflects it in the URL and the request', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="sort-toggle-button"]').trigger('click')
    await wrapper.get('[data-testid="sort-axis-millesime"]').setValue(true)
    await wrapper.get('[data-testid="sort-direction-desc"]').trigger('click')
    await waitForHeader(wrapper)

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'millesime' })
    expect(historyRequests()).toEqual(['/consumptions', '/consumptions?sort_by=millesime'])
  })

  it('resets to page 1 when the sort changes', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history?page=2')
    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await waitForHeader(wrapper)

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer', sort_dir: 'asc' })
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 of 3')
  })

  it('keeps sort and page when paging and when going back from a wine detail', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history?sort_by=producer')
    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer', page: '2' })

    await router.push('/wines/11')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer', page: '2' })
    expect(historyRequests().at(-1)).toBe('/consumptions?sort_by=producer')
  })
})

describe('ConsumptionHistoryView filters', () => {
  it('shows meal, appellation and color filters but no "ready now"', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history')

    for (const testid of ['meal-filter', 'appellation-filter', 'color-filter']) {
      expect(wrapper.find(`[data-testid="${testid}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="${testid}-mobile"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="ready-now-filter"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ready-now-filter-mobile"]').exists()).toBe(false)
  })

  it('pre-applies filters and sort from the URL query params on load', async () => {
    await mockApi()

    const { wrapper } = await mountAt('/history?meal_id=7&appellation_id=1&color=rouge&sort_by=producer')

    expect(historyRequests()).toEqual(['/consumptions?meal_id=7&appellation_id=1&color=rouge&sort_by=producer'])
    expect(wrapper.get('[data-testid="filter-toggle-button"]').text()).toContain('3')
  })

  it('changes the URL and the request when a filter changes, keeping the sort', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history?sort_by=producer')
    await wrapper.get('[data-testid="color-filter"]').setValue('blanc')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'blanc', sort_by: 'producer' })
    expect(historyRequests().at(-1)).toBe('/consumptions?color=blanc&sort_by=producer')
  })

  it('filters by meal through the meal picker', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="meal-filter-input"]').trigger('focus')
    await wrapper.get('[data-testid="meal-filter-option"]').trigger('mousedown')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ meal_id: '7' })
    expect(historyRequests().at(-1)).toBe('/consumptions?meal_id=7')
  })

  it('applies filters from the mobile panel', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="filter-toggle-button"]').trigger('click')
    await wrapper.get('[data-testid="color-filter-mobile"]').setValue('rose')
    await wrapper.get('[data-testid="filter-panel-apply"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rose' })
    expect(historyRequests().at(-1)).toBe('/consumptions?color=rose')
  })

  it('resets to page 1 when a filter changes', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history?page=2')
    await wrapper.get('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rouge' })
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 of 3')
  })

  it('keeps filters when sorting and paging, and when going back from a wine detail', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history?color=rouge')
    await wrapper.get('[data-testid="sort-header-producer"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()
    const expected = { color: 'rouge', sort_by: 'producer', sort_dir: 'asc', page: '2' }
    expect(router.currentRoute.value.query).toEqual(expected)

    await router.push('/wines/11')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual(expected)
    expect(historyRequests().at(-1)).toBe('/consumptions?color=rouge&sort_by=producer&sort_dir=asc')
  })

  it('moves between prior filter states on browser back', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history')
    await wrapper.get('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(historyRequests().at(-1)).toBe('/consumptions')
  })

  it('clears every filter from the filter bar, keeping the sort', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history?color=rouge&appellation_id=1&sort_by=producer')
    await wrapper.get('[data-testid="clear-filters-button"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer' })
    expect(historyRequests().at(-1)).toBe('/consumptions?sort_by=producer')
  })

  it('clears every filter from the mobile filter bar, keeping the sort', async () => {
    await mockApi()

    const { wrapper, router } = await mountAt('/history?color=rouge&sort_by=producer')
    await wrapper.get('[data-testid="mobile-clear-filters-button"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_by: 'producer' })
    expect(wrapper.get('[data-testid="filter-toggle-button"]').text()).not.toMatch(/\d/)
  })

  it('says no consumption matches the filters and offers to clear them', async () => {
    await mockApi({ history: [] })

    const { wrapper, router } = await mountAt('/history?color=rose&sort_dir=asc')

    expect(wrapper.text()).toContain('No consumption matches these filters')
    expect(wrapper.text()).not.toContain('No consumption recorded yet')

    await mockApi()
    await wrapper.get('[data-testid="history-clear-filters"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort_dir: 'asc' })
    expect(wrapper.findAll('[data-testid="consumption-item"]')).toHaveLength(2)
  })

  it('offers no clear-filters action in the no-filters empty state', async () => {
    await mockApi({ history: [] })

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('No consumption recorded yet')
    expect(wrapper.find('[data-testid="history-clear-filters"]').exists()).toBe(false)
  })
})

describe('ConsumptionHistoryView pagination', () => {
  it('shows the first page with Previous disabled', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper } = await mountAt('/history')

    expect(wrapper.findAll('[data-testid="consumption-item"]')).toHaveLength(10)
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 of 3')
    expect(wrapper.get('[data-testid="pagination-previous"]').attributes('disabled')).toBeDefined()
    expect(links(wrapper)[0]).toBe('/wines/25')
  })

  it('hides the controls when everything fits on one page', async () => {
    await mockApi({ history: manyEntries(10) })

    const { wrapper } = await mountAt('/history')

    expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(false)
  })

  it('puts the page in the address on Next and Previous without refetching', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history')
    vi.mocked(apiClient.get).mockClear()

    await wrapper.get('[data-testid="pagination-next"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(links(wrapper)[0]).toBe('/wines/15')
    expect(historyRequests()).toEqual([])

    await wrapper.get('[data-testid="pagination-previous"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('clamps a page beyond the last to the last page', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper } = await mountAt('/history?page=99')

    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 3 of 3')
    expect(wrapper.findAll('[data-testid="consumption-item"]')).toHaveLength(5)
  })

  it('restores the page when going back from a wine detail', async () => {
    await mockApi({ history: manyEntries(25) })

    const { wrapper, router } = await mountAt('/history?page=2')
    await router.push('/wines/11')
    await flushPromises()
    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 2 of 3')
  })

  it('holds back scroll restoration until the rows have rendered', async () => {
    let answer!: (entries: ConsumptionHistoryEntry[]) => void
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/consumptions') return new Promise((resolve) => (answer = resolve as never))
      return Promise.resolve(path === '/meals' ? meals : appellations)
    })
    const { wrapper } = await mountAt('/history?page=2')

    const restored = Promise.resolve(
      scrollBehavior(route('history'), route('wine-detail'), { left: 0, top: 300 }),
    ).then(() => 'restored')
    const early = await Promise.race([restored, flushPromises().then(() => 'waiting')])
    expect(early).toBe('waiting')

    answer(manyEntries(25))
    await flushPromises()

    expect(await restored).toBe('restored')
    expect(wrapper.findAll('[data-testid="consumption-item"]')).toHaveLength(10)
  })
})

describe('ConsumptionHistoryView in French', () => {
  it('renders the rows, columns and controls in French', async () => {
    await mockApi({ history: [...history, ...manyEntries(10)] })
    setTestLocale('fr')

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('12 consommations')
    expect(wrapper.get('[data-testid="consumption-columns"]').text()).toContain('Millésime')
    const items = wrapper.findAll('[data-testid="consumption-item"]')
    expect(items[0]!.text()).toContain('Rouge · Chinon')
    expect(items[0]!.text()).toContain('12 mars 2026')
    expect(items[1]!.text()).toContain('SA')
    expect(wrapper.get('[data-testid="pagination-status"]').text()).toBe('Page 1 sur 2')
  })

  it('labels the sort panel axes in French', async () => {
    await mockApi()
    setTestLocale('fr')

    const { wrapper } = await mountAt('/history')

    const axes = wrapper.get('[data-testid="sort-panel"]').findAll('label').map((l) => l.text())
    expect(axes).toEqual(['Producteur', 'Appellation', 'Millésime', 'Date de consommation'])
  })

  it('says so in French when no consumption has been recorded yet', async () => {
    await mockApi({ history: [] })
    setTestLocale('fr')

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('Aucune consommation enregistrée pour le moment')
  })

  it('says so in French when no consumption matches the filters', async () => {
    await mockApi({ history: [] })
    setTestLocale('fr')

    const { wrapper } = await mountAt('/history?color=rose')

    expect(wrapper.text()).toContain('Aucune consommation ne correspond à ces filtres')
    expect(wrapper.get('[data-testid="history-clear-filters"]').text()).toBe('Effacer les filtres')
  })

  it('uses the singular for a single consumption', async () => {
    await mockApi({ history: [history[0]!] })
    setTestLocale('fr')

    const { wrapper } = await mountAt('/history')

    expect(wrapper.text()).toContain('1 consommation')
    expect(wrapper.text()).not.toContain('1 consommations')
  })
})

// The local-store reads chain several Dexie/IndexedDB operations (each a
// macrotask under fake-indexeddb), so a couple of ticks isn't always enough.
async function flushPromises() {
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}
