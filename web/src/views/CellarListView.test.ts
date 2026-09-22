import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import CellarListView from './CellarListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

const currentYear = new Date().getFullYear()

const searchResults = [
  {
    id: 1,
    millesime: 2018,
    appellation_id: 1,
    producer: 'Les Garillères',
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
    producer: 'Domaine X',
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

function mockApi(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(appellations)
    if (path === '/meals') return Promise.resolve(meals)
    if (path.startsWith('/search')) return Promise.resolve(overrides.search ?? searchResults)
    throw new Error(`unexpected path: ${path}`)
  })
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
    mockApi()

    const { wrapper } = await mountAt('/')

    expect(apiClient.get).toHaveBeenCalledWith('/search')

    const items = wrapper.findAll('[data-testid="wine-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Les Garillères')
    expect(items[0]!.text()).toContain('Chinon')
    expect(items[0]!.text()).toContain('Ready')
    expect(items[1]!.text()).toContain('Domaine X')
    expect(items[1]!.text()).toContain('Too young')
  })

  it('links each wine item to its detail view', async () => {
    mockApi()

    const { wrapper } = await mountAt('/')

    const links = wrapper.findAll('[data-testid="wine-link"]')
    expect(links).toHaveLength(2)
    expect(links[0]!.attributes('href')).toBe('/wines/1')
    expect(links[1]!.attributes('href')).toBe('/wines/2')
  })

  it('links to the add-wine form', async () => {
    mockApi()

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('[data-testid="add-wine-link"]').attributes('href')).toBe('/wines/new')
  })

  it('shows an error state distinct from loading when a fetch fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith('/search')) return Promise.reject(new Error('server exploded'))
      return Promise.resolve([])
    })

    const { wrapper } = await mountAt('/')

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
  })

  it('pre-applies filters from the URL query params on load', async () => {
    mockApi()

    await mountAt('/?appellation_id=1&color=rouge&ready_now=true')

    expect(apiClient.get).toHaveBeenCalledWith('/search?appellation_id=1&color=rouge&ready_now=true')
  })

  it('combines filter changes from the filter bar with AND semantics and reflects them in the URL', async () => {
    mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.find('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()
    await wrapper.find('[data-testid="ready-now-filter"]').setValue(true)
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ color: 'rouge', ready_now: 'true' })
    expect(apiClient.get).toHaveBeenLastCalledWith('/search?color=rouge&ready_now=true')
  })

  it('moves between prior filter states on browser back', async () => {
    mockApi()

    const { wrapper, router } = await mountAt('/')

    await wrapper.find('[data-testid="color-filter"]').setValue('rouge')
    await flushPromises()

    await router.back()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(apiClient.get).toHaveBeenLastCalledWith('/search')
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
