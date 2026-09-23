import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import WineDetailView from './WineDetailView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

function fillConsumptionForm(
  wrapper: ReturnType<typeof mount>,
  { date, rating, notes }: { date: string; rating?: string; notes?: string },
) {
  wrapper.get('[data-testid="consumption-date-input"]').setValue(date)
  if (rating !== undefined) wrapper.get('[data-testid="consumption-rating-input"]').setValue(rating)
  if (notes !== undefined) wrapper.get('[data-testid="consumption-notes-input"]').setValue(notes)
}

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
    routes: [
      { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
      { path: '/wines/:id/edit', name: 'wine-edit', component: WineDetailView },
      { path: '/meal-pairings', name: 'meal-pairings', component: WineDetailView },
    ],
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

  it('links to the edit form for this wine', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.get('[data-testid="edit-wine-link"]').attributes('href')).toBe('/wines/1/edit')
  })

  it('links to meal pairing admin pre-filled with this wine\'s appellation and color', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.get('[data-testid="manage-pairings-link"]').attributes('href')).toBe(
      '/meal-pairings?appellation_id=1&color=rouge',
    )
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

  it('retries loading the wine when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines/1') return Promise.reject(new Error('server exploded'))
      return Promise.resolve([])
    })

    const { wrapper } = await mountAt('/wines/1')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockApi()
    await wrapper.get('[data-testid="wine-detail-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-detail"]').exists()).toBe(true)
  })

  it('records a consumption and refreshes quantity and history on success', async () => {
    let consumptionRecorded = false
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      if (path === '/wines/1') {
        return Promise.resolve(
          consumptionRecorded
            ? {
                ...wineDetail,
                quantity: 2,
                consumption_history: [
                  ...wineDetail.consumption_history,
                  { id: 3, wine_id: 1, date: '2026-03-01', rating: 5, notes: 'Superb' },
                ],
              }
            : wineDetail,
        )
      }
      throw new Error(`unexpected path: ${path}`)
    })
    vi.mocked(apiClient.post).mockImplementation(() => {
      consumptionRecorded = true
      return Promise.resolve({ id: 3, wine_id: 1, date: '2026-03-01', rating: 5, notes: 'Superb' })
    })

    const { wrapper } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01', rating: '5', notes: 'Superb' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/wines/1/consumptions', {
      date: '2026-03-01',
      rating: 5,
      notes: 'Superb',
    })

    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('Qty: 2')
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="consumption-success"]').text()).toMatch(/recorded/i)
  })

  it('clears a stale consumption success message when navigating to a different wine', async () => {
    const wineTwo = { ...wineDetail, id: 2, producer: 'Domaine Autre' }
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      if (path === '/wines/1') return Promise.resolve(wineDetail)
      if (path === '/wines/2') return Promise.resolve(wineTwo)
      throw new Error(`unexpected path: ${path}`)
    })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 3, wine_id: 1, date: '2026-03-01', rating: null, notes: null })

    const { wrapper, router } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[data-testid="consumption-success"]').exists()).toBe(true)

    await router.push('/wines/2')
    await flushPromises()

    expect(wrapper.find('[data-testid="consumption-success"]').exists()).toBe(false)
  })

  it('clears a stale consumption error when navigating to a different wine', async () => {
    const wineTwo = { ...wineDetail, id: 2, producer: 'Domaine Autre' }
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      if (path === '/wines/1') return Promise.resolve(wineDetail)
      if (path === '/wines/2') return Promise.resolve(wineTwo)
      throw new Error(`unexpected path: ${path}`)
    })
    vi.mocked(apiClient.post).mockRejectedValue(new Error('server exploded'))

    const { wrapper, router } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await router.push('/wines/2')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('blocks the consumption form when quantity is already zero', async () => {
    mockApi({ wine: { ...wineDetail, quantity: 0 } })

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.find('[data-testid="consumption-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="consumption-blocked-message"]').text()).toMatch(
      /no bottles left/i,
    )
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
