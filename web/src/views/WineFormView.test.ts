import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import WineDetailView from './WineDetailView.vue'
import WineFormView from './WineFormView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})

const appellations = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
]

const existingWine = {
  id: 5,
  millesime: 2018,
  appellation_id: 1,
  producer: 'Les Garillères',
  color: 'rouge',
  garde_debut: 2020,
  garde_fin: 2028,
  quantity: 3,
  suggested_meals: [],
  consumption_history: [],
}

function mockGet(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(overrides.appellations ?? appellations)
    if (path === '/wines/5') return Promise.resolve(overrides.wine ?? existingWine)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/wines/new', name: 'wine-new', component: WineFormView },
      { path: '/wines/:id', name: 'wine-detail', component: WineDetailView },
      { path: '/wines/:id/edit', name: 'wine-edit', component: WineFormView },
    ],
  })
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(WineFormView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

async function fillValidForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-testid="wine-appellation-input"]').setValue('Chinon')
  await wrapper
    .findAll('[data-testid="wine-appellation-option"]')[0]!
    .trigger('mousedown')
  await wrapper.get('[data-testid="wine-producer-input"]').setValue('Les Garillères')
  await wrapper.get('[data-testid="wine-color-input"]').setValue('rouge')
  await wrapper.get('[data-testid="wine-garde-debut-input"]').setValue('2020')
  await wrapper.get('[data-testid="wine-garde-fin-input"]').setValue('2028')
  await wrapper.get('[data-testid="wine-quantity-input"]').setValue('6')
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.useRealTimers()
})

describe('WineFormView — add', () => {
  it('shows a blank form ready to submit a new wine', async () => {
    mockGet()

    const { wrapper } = await mountAt('/wines/new')

    expect(wrapper.text()).toContain('Add wine')
    expect((wrapper.get('[data-testid="wine-producer-input"]').element as HTMLInputElement).value).toBe(
      '',
    )
  })

  it('blocks submit and shows field errors when required fields are missing', async () => {
    mockGet()

    const { wrapper } = await mountAt('/wines/new')
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="wine-appellation-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wine-producer-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wine-color-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wine-garde-debut-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wine-garde-fin-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="wine-quantity-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('rejects garde_debut greater than garde_fin', async () => {
    mockGet()

    const { wrapper } = await mountAt('/wines/new')
    await fillValidForm(wrapper)
    await wrapper.get('[data-testid="wine-garde-debut-input"]').setValue('2030')
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="wine-garde-fin-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('rejects a negative quantity', async () => {
    mockGet()

    const { wrapper } = await mountAt('/wines/new')
    await fillValidForm(wrapper)
    await wrapper.get('[data-testid="wine-quantity-input"]').setValue('-1')
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="wine-quantity-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('submits a POST and navigates to the new wine detail view on success', async () => {
    mockGet()
    vi.mocked(apiClient.post).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve({ id: 9 })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/wines/new')
    await fillValidForm(wrapper)

    vi.useFakeTimers()
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')
    await vi.advanceTimersByTimeAsync(0)

    expect(apiClient.post).toHaveBeenCalledWith('/wines', {
      millesime: null,
      appellation_id: 1,
      producer: 'Les Garillères',
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
      quantity: 6,
    })
    expect(wrapper.get('[data-testid="wine-form-success"]').text()).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/wines/new')

    await vi.advanceTimersByTimeAsync(1000)
    expect(router.currentRoute.value.fullPath).toBe('/wines/9')
  })

  it('creates a new appellation inline and selects it', async () => {
    mockGet()
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/appellations') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/wines/new')
    await wrapper.get('[data-testid="new-appellation-toggle"]').trigger('click')
    await wrapper.get('[data-testid="new-appellation-name-input"]').setValue('Bourgueil')
    await wrapper.get('[data-testid="new-appellation-submit"]').trigger('click')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/appellations', { name: 'Bourgueil' })
    expect(
      (wrapper.get('[data-testid="wine-appellation-input"]').element as HTMLInputElement).value,
    ).toBe('Bourgueil')
    expect(wrapper.find('[data-testid="new-appellation-name-input"]').exists()).toBe(false)
  })

  it('creates a new appellation on Enter in its name input, without submitting the wine form', async () => {
    mockGet()
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/appellations') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/wines/new')
    await wrapper.get('[data-testid="new-appellation-toggle"]').trigger('click')
    const nameInput = wrapper.get('[data-testid="new-appellation-name-input"]')
    await nameInput.setValue('Bourgueil')
    await nameInput.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/appellations', { name: 'Bourgueil' })
    expect(apiClient.post).not.toHaveBeenCalledWith('/wines', expect.anything())
  })
})

describe('WineFormView — edit', () => {
  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines/5') return Promise.reject(new Error('server exploded'))
      return Promise.resolve(appellations)
    })

    const { wrapper } = await mountAt('/wines/5/edit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="wine-form-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-form"]').exists()).toBe(true)
  })

  it('pre-fills the form with the existing wine values', async () => {
    mockGet()

    const { wrapper } = await mountAt('/wines/5/edit')

    expect(wrapper.text()).toContain('Edit wine')
    expect((wrapper.get('[data-testid="wine-producer-input"]').element as HTMLInputElement).value).toBe(
      'Les Garillères',
    )
    expect(
      (wrapper.get('[data-testid="wine-appellation-input"]').element as HTMLInputElement).value,
    ).toBe('Chinon')
    expect((wrapper.get('[data-testid="wine-quantity-input"]').element as HTMLInputElement).value).toBe(
      '3',
    )
  })

  it('submits a PUT and navigates to the wine detail view on success', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockImplementation((path: string) => {
      if (path === '/wines/5') return Promise.resolve({ id: 5 })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/wines/5/edit')
    await wrapper.get('[data-testid="wine-producer-input"]').setValue('Domaine Les Garillères')

    vi.useFakeTimers()
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')
    await vi.advanceTimersByTimeAsync(0)

    expect(apiClient.put).toHaveBeenCalledWith('/wines/5', {
      millesime: 2018,
      appellation_id: 1,
      producer: 'Domaine Les Garillères',
      color: 'rouge',
      garde_debut: 2020,
      garde_fin: 2028,
      quantity: 3,
    })
    expect(wrapper.get('[data-testid="wine-form-success"]').text()).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/wines/5/edit')

    await vi.advanceTimersByTimeAsync(1000)
    expect(router.currentRoute.value.fullPath).toBe('/wines/5')
  })

  it('shows a submit error without navigating when the save fails', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockRejectedValue(new Error('server exploded'))

    const { wrapper, router } = await mountAt('/wines/5/edit')
    await wrapper.get('[data-testid="wine-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/wines/5/edit')
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
