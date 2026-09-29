import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import type { WineDetail } from '../api/types'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { db } from '../db/localDb'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import WineDetailView from './WineDetailView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// A request that never settles, for asserting the UI updates locally without
// waiting on the network.
function neverResolves<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

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
  producer_id: 1,
  producer: { id: 1, name: 'Les Garillères' },
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
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
        { path: '/wines/:id/edit', name: 'wine-edit', component: WineDetailView },
        { path: '/meal-pairings', name: 'meal-pairings', component: WineDetailView },
      ],
    }),
  )
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
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

resetSuccessMessageAfterEach()

describe('WineDetailView', () => {
  it('renders a previously-cached wine from the local store when the network is fully disabled', async () => {
    await db.wines.put(wineDetail as WineDetail)
    await db.appellations.bulkPut(appellations)
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error: unable to reach the server'))

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('Les Garillères')
    expect(detail.text()).toContain('Chinon')
  })

  it('never fetches a not-yet-synced (local-only) wine, since it cannot exist on the server yet', async () => {
    const localOnly = { ...wineDetail, id: -123 } as WineDetail
    await db.wines.put(localOnly)
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/wines/-123')

    expect(apiClient.get).not.toHaveBeenCalledWith('/wines/-123')
    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('Les Garillères')
  })

  it('redirects to the synced server id when the local id it was opened with has since synced', async () => {
    await db.wines.put(wineDetail as WineDetail)
    await db.idRemap.put({ localId: -123, serverId: 1 })
    mockApi()

    const { wrapper, router } = await mountAt('/wines/-123')

    expect(router.currentRoute.value.fullPath).toBe('/wines/1')
    expect(apiClient.get).toHaveBeenCalledWith('/wines/1')
    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('Les Garillères')
    expect(wrapper.get('[data-testid="edit-wine-link"]').attributes('href')).toBe('/wines/1/edit')
  })

  it('shows a loading indicator before the fetches resolve', async () => {
    vi.mocked(apiClient.get).mockReturnValue(neverResolves())

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
    expect(detail.text()).toContain('×3')

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

  it('records a consumption locally and updates quantity/history immediately, without waiting on the network', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockReturnValue(neverResolves())

    const { wrapper } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01', rating: '5', notes: 'Superb' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()

    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('×2')
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(3)
    expect(useSuccessMessage().message.value).toMatch(/recorded/i)
  })

  it('queues the consumption create and syncs it to the backend with a client_id once online', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockResolvedValue({ id: 3, wine_id: 1, date: '2026-03-01', rating: 5, notes: 'Superb' })

    const { wrapper } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01', rating: '5', notes: 'Superb' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/wines/1/consumptions', {
      date: '2026-03-01',
      rating: 5,
      notes: 'Superb',
      client_id: expect.any(String),
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('clears a stale consumption success message when navigating to a different wine', async () => {
    const wineTwo = { ...wineDetail, id: 2, producer: { id: 2, name: 'Domaine Autre' } }
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
    expect(useSuccessMessage().message.value).not.toBeNull()

    await router.push('/wines/2')
    await flushPromises()

    expect(useSuccessMessage().message.value).toBeNull()
  })

  it('edits a consumption entry inline and refreshes the history on success', async () => {
    let edited = false
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      if (path === '/wines/1') {
        return Promise.resolve(
          edited
            ? {
                ...wineDetail,
                consumption_history: [
                  { id: 1, wine_id: 1, date: '2026-01-05', rating: 5, notes: 'Even better than remembered' },
                  wineDetail.consumption_history[1],
                ],
              }
            : wineDetail,
        )
      }
      throw new Error(`unexpected path: ${path}`)
    })
    vi.mocked(apiClient.put).mockImplementation(() => {
      edited = true
      return Promise.resolve({ id: 1, wine_id: 1, date: '2026-01-05', rating: 5, notes: 'Even better than remembered' })
    })

    const { wrapper } = await mountAt('/wines/1')

    const entries = wrapper.findAll('[data-testid="consumption-entry"]')
    await entries[0]!.get('[data-testid="consumption-edit-button"]').trigger('click')

    const form = wrapper.get('[data-testid="consumption-edit-form"]')
    expect((form.get('[data-testid="consumption-edit-date-input"]').element as HTMLInputElement).value).toBe(
      '2026-01-01',
    )
    expect((form.get('[data-testid="consumption-edit-rating-input"]').element as HTMLInputElement).value).toBe('4')
    expect((form.get('[data-testid="consumption-edit-notes-input"]').element as HTMLTextAreaElement).value).toBe(
      'Great with duck',
    )

    await form.get('[data-testid="consumption-edit-date-input"]').setValue('2026-01-05')
    await form.get('[data-testid="consumption-edit-rating-input"]').setValue('5')
    await form.get('[data-testid="consumption-edit-notes-input"]').setValue('Even better than remembered')
    await form.trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.put).toHaveBeenCalledWith('/consumptions/1', {
      date: '2026-01-05',
      rating: 5,
      notes: 'Even better than remembered',
    })
    expect(wrapper.find('[data-testid="consumption-edit-form"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('2026-01-05')
    expect(wrapper.text()).toContain('Even better than remembered')
    expect(useSuccessMessage().message.value).toMatch(/updated/i)
  })

  it('cancels an inline edit without calling the API', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    const entries = wrapper.findAll('[data-testid="consumption-entry"]')
    await entries[0]!.get('[data-testid="consumption-edit-button"]').trigger('click')
    expect(wrapper.find('[data-testid="consumption-edit-form"]').exists()).toBe(true)

    await wrapper.get('[data-testid="consumption-edit-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="consumption-edit-form"]').exists()).toBe(false)
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it('opens the confirm dialog on delete and does nothing on cancel', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    const entries = wrapper.findAll('[data-testid="consumption-entry"]')
    await entries[1]!.get('[data-testid="consumption-delete-button"]').trigger('click')

    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Delete consumption from 2026-02-01?')

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()

    expect(dialog.open).toBe(false)
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(2)
  })

  it('deletes a consumption entry on confirm and refreshes quantity and history', async () => {
    let deleted = false
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/appellations') return Promise.resolve(appellations)
      if (path === '/wines/1') {
        return Promise.resolve(
          deleted
            ? { ...wineDetail, quantity: 4, consumption_history: [wineDetail.consumption_history[0]] }
            : wineDetail,
        )
      }
      throw new Error(`unexpected path: ${path}`)
    })
    vi.mocked(apiClient.delete).mockImplementation(() => {
      deleted = true
      return Promise.resolve(undefined)
    })

    const { wrapper } = await mountAt('/wines/1')

    const entries = wrapper.findAll('[data-testid="consumption-entry"]')
    await entries[1]!.get('[data-testid="consumption-delete-button"]').trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/consumptions/2', undefined)
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(1)
    const detail = wrapper.get('[data-testid="wine-detail"]')
    expect(detail.text()).toContain('×4')
    expect(useSuccessMessage().message.value).toMatch(/deleted/i)
  })

  it('cancels a not-yet-synced consumption before it syncs, without calling the API', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockReturnValue(neverResolves())

    const { wrapper } = await mountAt('/wines/1')

    fillConsumptionForm(wrapper, { date: '2026-03-01', rating: '5', notes: 'Superb' })
    await wrapper.get('[data-testid="consumption-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="wine-detail"]').text()).toContain('×2')

    const entries = wrapper.findAll('[data-testid="consumption-entry"]')
    await entries[2]!.get('[data-testid="consumption-delete-button"]').trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="consumption-entry"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="wine-detail"]').text()).toContain('×3')
    expect(await db.outbox.where('entity').equals('consumption').count()).toBe(0)
  })

  it('blocks the consumption form when quantity is already zero', async () => {
    mockApi({ wine: { ...wineDetail, quantity: 0 } })

    const { wrapper } = await mountAt('/wines/1')

    expect(wrapper.find('[data-testid="consumption-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="consumption-blocked-message"]').text()).toMatch(
      /no bottles left/i,
    )
  })

  it('adjusts quantity locally and immediately, without waiting on the network', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockReturnValue(neverResolves())

    const { wrapper } = await mountAt('/wines/1')

    await wrapper.get('[data-testid="quantity-adjustment-delta-input"]').setValue('3')
    await wrapper.get('[data-testid="quantity-adjustment-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.get('[data-testid="wine-detail"]').text()).toContain('×6')
    expect(useSuccessMessage().message.value).toMatch(/adjusted/i)
  })

  it('queues the manual quantity adjustment and syncs it with a client_id once online', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockResolvedValue({ ...wineDetail, quantity: 6 })

    const { wrapper } = await mountAt('/wines/1')

    await wrapper.get('[data-testid="quantity-adjustment-delta-input"]').setValue('3')
    await wrapper.get('[data-testid="quantity-adjustment-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/wines/1/quantity-adjustments', {
      delta: 3,
      client_id: expect.any(String),
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('rejects a manual quantity adjustment that would take quantity below zero', async () => {
    mockApi()

    const { wrapper } = await mountAt('/wines/1')

    await wrapper.get('[data-testid="quantity-adjustment-delta-input"]').setValue('-10')
    await wrapper.get('[data-testid="quantity-adjustment-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.get('[data-testid="wine-detail"]').text()).toContain('×3')
    expect(wrapper.text()).toMatch(/nothing left/i)
    expect(apiClient.post).not.toHaveBeenCalled()
  })
})

// The local-store read/write path (load()/pushChangesInBackground chaining
// pushWines then pushConsumptions) adds several extra macrotasks under
// fake-indexeddb versus a plain fetch mock.
async function flushPromises() {
  for (let i = 0; i < 16; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
