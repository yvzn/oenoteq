import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { db } from '../db/localDb'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import MealPairingView from './MealPairingView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const appellations = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
]

const meals = [
  { id: 1, name: 'Boeuf bourguignon' },
  { id: 2, name: 'Canard' },
]

const pairedMeals = [{ id: 1, name: 'Boeuf bourguignon' }]

function mockApi(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(overrides.appellations ?? appellations)
    if (path === '/meals') return Promise.resolve(overrides.meals ?? meals)
    if (path.startsWith('/meal-pairings')) return Promise.resolve(overrides.pairedMeals ?? pairedMeals)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/meal-pairings', name: 'meal-pairings', component: MealPairingView },
        { path: '/', name: 'cellar', component: MealPairingView },
      ],
    }),
  )
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(MealPairingView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

async function createNewMeal(wrapper: ReturnType<typeof mount>, name: string) {
  await wrapper.get('[data-testid="add-meal-autocomplete-input"]').setValue(name)
  await wrapper.get('[data-testid="add-meal-autocomplete-create-option"]').trigger('mousedown')
}

async function selectAppellationAndColor(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-testid="meal-pairing-appellation-input"]').setValue('Chinon')
  await wrapper.findAll('[data-testid="meal-pairing-appellation-option"]')[0]!.trigger('mousedown')
  await wrapper.get('[data-testid="meal-pairing-color-input"]').setValue('rouge')
  await flushPromises()
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

resetSuccessMessageAfterEach()

describe('MealPairingView', () => {
  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/meals') return Promise.reject(new Error('server exploded'))
      return Promise.resolve(appellations)
    })

    const { wrapper } = await mountAt('/meal-pairings')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockApi()
    await wrapper.get('[data-testid="meal-pairing-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="meal-pairing-appellation-input"]').exists()).toBe(true)
  })

  it('lists the meals currently paired once an appellation and color are picked', async () => {
    mockApi()

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    expect(apiClient.get).toHaveBeenCalledWith('/meal-pairings?appellation_id=1&color=rouge')
    const items = wrapper.findAll('[data-testid="paired-meal"]')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('Boeuf bourguignon')
  })

  it('pre-fills appellation and color from query params', async () => {
    mockApi()

    const { wrapper } = await mountAt('/meal-pairings?appellation_id=1&color=rouge')

    expect(apiClient.get).toHaveBeenCalledWith('/meal-pairings?appellation_id=1&color=rouge')
    expect(
      (wrapper.get('[data-testid="meal-pairing-appellation-input"]').element as HTMLInputElement).value,
    ).toBe('Chinon')
    expect(
      (wrapper.get('[data-testid="meal-pairing-color-input"]').element as HTMLSelectElement).value,
    ).toBe('rouge')
  })

  it('adds a meal to the pairing via autocomplete', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockResolvedValue({ appellation_id: 1, color: 'rouge', meal_id: 2 })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await wrapper.get('[data-testid="add-meal-autocomplete-input"]').setValue('Canard')
    await wrapper.findAll('[data-testid="add-meal-autocomplete-option"]')[0]!.trigger('mousedown')
    await wrapper.get('[data-testid="add-meal-button"]').trigger('click')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 2,
    })
    expect(useSuccessMessage().message.value).toMatch(/added/i)
  })

  it('removes a meal from the pairing', async () => {
    mockApi()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await wrapper.get('[data-testid="remove-meal-button"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 1,
    })
    expect(useSuccessMessage().message.value).toMatch(/removed/i)
  })

  it('clears a stale pairing success message when the color selection changes', async () => {
    mockApi()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await wrapper.get('[data-testid="remove-meal-button"]').trigger('click')
    await flushPromises()
    expect(useSuccessMessage().message.value).not.toBeNull()

    await wrapper.get('[data-testid="meal-pairing-color-input"]').setValue('blanc')
    await flushPromises()

    expect(useSuccessMessage().message.value).toBeNull()
  })

  it('clears a stale pairing success message when navigating away', async () => {
    mockApi()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper, router } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await wrapper.get('[data-testid="remove-meal-button"]').trigger('click')
    await flushPromises()
    expect(useSuccessMessage().message.value).not.toBeNull()

    await router.push('/')

    expect(useSuccessMessage().message.value).toBeNull()
  })

  it('submits the add-meal form on Enter once a match is selected', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockResolvedValue({ appellation_id: 1, color: 'rouge', meal_id: 2 })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    const input = wrapper.get('[data-testid="add-meal-autocomplete-input"]')
    await input.setValue('Canard')
    await wrapper.findAll('[data-testid="add-meal-autocomplete-option"]')[0]!.trigger('mousedown')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 2,
    })
  })

  it('lets Enter highlight-select an autocomplete match before submitting the add-meal form', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockResolvedValue({ appellation_id: 1, color: 'rouge', meal_id: 2 })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    const input = wrapper.get('[data-testid="add-meal-autocomplete-input"]')
    await input.setValue('Canard')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(apiClient.post).not.toHaveBeenCalled()
    expect((input.element as HTMLInputElement).value).toBe('Canard')

    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 2,
    })
  })

  it('creates a new meal on Enter in the add-meal combobox', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/meals') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    const input = wrapper.get('[data-testid="add-meal-autocomplete-input"]')
    await input.setValue('Tartiflette')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meals', {
      name: 'Tartiflette',
      client_id: expect.any(String),
    })
  })

  it('creates a new meal inline and pairs it immediately when no match exists', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/meals') return Promise.resolve({ id: 3, ...(body as object) })
      if (path === '/meal-pairings') return Promise.resolve({ appellation_id: 1, color: 'rouge', meal_id: 3 })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    mockApi({ pairedMeals: [...pairedMeals, { id: 3, name: 'Tartiflette' }] })

    await createNewMeal(wrapper, 'Tartiflette')
    await flushPromises()
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meals', {
      name: 'Tartiflette',
      client_id: expect.any(String),
    })
    expect(apiClient.post).toHaveBeenCalledWith('/meal-pairings', {
      appellation_id: 1,
      color: 'rouge',
      meal_id: 3,
    })
    const items = wrapper.findAll('[data-testid="paired-meal"]')
    expect(items.some((i) => i.text().includes('Tartiflette'))).toBe(true)
    expect(wrapper.find('[data-testid="add-meal-autocomplete-create-option"]').exists()).toBe(false)
    expect(useSuccessMessage().message.value).toMatch(/added/i)
  })

  it('creates and pairs a new meal immediately even when the network rejects the pairing, leaving it queued in the outbox', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/meals') return Promise.resolve({ id: 3, ...(body as object) })
      if (path === '/meal-pairings') return Promise.reject(new Error('pairing exploded'))
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await createNewMeal(wrapper, 'Tartiflette')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(wrapper.find('[data-testid="add-meal-autocomplete-create-option"]').exists()).toBe(false)
    const items = wrapper.findAll('[data-testid="paired-meal"]')
    expect(items.some((i) => i.text().includes('Tartiflette'))).toBe(true)

    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toMatchObject([
      { entity: 'meal_pairing', status: 'failed' },
    ])
  })

  it('still queues the pairing (referencing the not-yet-synced meal) even when the meal create itself is rejected', async () => {
    mockApi()
    vi.mocked(apiClient.post).mockImplementation((path: string) => {
      if (path === '/meals') return Promise.reject(new Error('create exploded'))
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper } = await mountAt('/meal-pairings')
    await selectAppellationAndColor(wrapper)

    await createNewMeal(wrapper, 'Tartiflette')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/added/i)
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toMatchObject([
      { entity: 'meal', action: 'create', status: 'failed' },
      { entity: 'meal_pairing', status: 'pending' },
    ])
    expect(apiClient.post).not.toHaveBeenCalledWith('/meal-pairings', expect.anything())
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
