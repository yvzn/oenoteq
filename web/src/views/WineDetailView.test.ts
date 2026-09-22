import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import WineDetailView from './WineDetailView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

const currentYear = new Date().getFullYear()

const wineDetail = {
  id: 1,
  millesime: 2018,
  appellation_id: 1,
  producer: 'Les Garillères',
  color: 'rouge',
  garde_debut: currentYear - 5,
  garde_fin: currentYear + 5,
  quantity: 3,
  suggested_meals: [
    { id: 1, name: 'Boeuf bourguignon' },
    { id: 2, name: 'Canard' },
  ],
  consumption_history: [
    { id: 1, wine_id: 1, date: '2026-01-01', rating: 4, notes: 'Great with duck' },
    { id: 2, wine_id: 1, date: '2026-02-01', rating: null, notes: null },
  ],
}

const appellations = [{ id: 1, name: 'Chinon' }]

function mockApi(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(appellations)
    if (path === '/wines/1') return Promise.resolve(overrides.wine ?? wineDetail)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/wines/:id', name: 'wine-detail', component: WineDetailView }],
  })
}

async function mountAt(initialPath: string, { flush = true }: { flush?: boolean } = {}) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(WineDetailView, { global: { plugins: [router] } })
  if (flush) await flushPromises()
  else await wrapper.vm.$nextTick()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('WineDetailView', () => {
  it('shows a loading indicator before the fetches resolve', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}))

    const { wrapper } = await mountAt('/wines/1', { flush: false })

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-detail"]').exists()).toBe(false)
  })

  it('renders wine fields, garde status, suggested meals, and consumption history', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    expect(apiClient.get).toHaveBeenCalledWith('/wines/1')

    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('Les Garillères')
    expect(detail.text()).toContain('Chinon')
    expect(detail.text()).toContain('2018')
    expect(detail.text()).toContain('rouge')
    expect(detail.text()).toContain('Ready')
    expect(detail.text()).toContain('Qty: 3')

    const meals = wrapper.findAll('[data-testid="suggested-meal"]')
    expect(meals).toHaveLength(2)
    expect(meals[0]!.text()).toBe('Boeuf bourguignon')
    expect(meals[1]!.text()).toBe('Canard')

    const consumptions = wrapper.findAll('[data-testid="consumption-entry"]')
    expect(consumptions).toHaveLength(2)
    expect(consumptions[0]!.text()).toContain('2026-01-01')
    expect(consumptions[0]!.text()).toContain('Rating: 4')
    expect(consumptions[0]!.text()).toContain('Great with duck')
    expect(consumptions[1]!.text()).toContain('2026-02-01')
  })

  it('shows an empty state when there are no suggested meals or consumption history', async () => {
    mockApi({ wine: { ...wineDetail, suggested_meals: [], consumption_history: [] } })

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.find('[data-testid="suggested-meal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="consumption-entry"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No suggestions yet.')
    expect(wrapper.text()).toContain('No consumptions recorded yet.')
  })

  it('shows an error state distinct from loading when a fetch fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines/1') return Promise.reject(new Error('server exploded'))
      return Promise.resolve([])
    })

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-detail"]').exists()).toBe(false)
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
