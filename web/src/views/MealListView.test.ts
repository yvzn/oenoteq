import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient, ApiError } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import MealFormView from './MealFormView.vue'
import MealListView from './MealListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const meals = [
  { id: 1, name: 'Oysters' },
  { id: 2, name: 'Grilled Fish' },
]

function mockGet(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/meals') return Promise.resolve(overrides.meals ?? meals)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/meals', name: 'meals', component: MealListView },
        { path: '/meals/new', name: 'meal-new', component: MealFormView },
        { path: '/meals/:id/edit', name: 'meal-edit', component: MealFormView },
      ],
    }),
  )
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(MealListView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

resetSuccessMessageAfterEach()

describe('MealListView', () => {
  it('lists all meals with links to rename and add', async () => {
    mockGet()

    const { wrapper } = await mountAt('/meals')

    const items = wrapper.findAll('[data-testid="meal-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('Oysters')
    expect(wrapper.text()).toContain('Grilled Fish')
    expect(wrapper.find('[data-testid="add-meal-link"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="meal-rename-link"]')).toHaveLength(2)
  })

  it('shows an empty state when there are no meals', async () => {
    mockGet({ meals: [] })

    const { wrapper } = await mountAt('/meals')

    expect(wrapper.text()).toContain('No meals yet.')
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/meals')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="meal-list-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="meal-list"]').exists()).toBe(true)
  })

  it('opens the confirm dialog on delete and does nothing on cancel', async () => {
    mockGet()

    const { wrapper } = await mountAt('/meals')
    await wrapper.findAll('[data-testid="meal-delete-button"]')[0]!.trigger('click')

    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Delete meal "Oysters"?')

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()

    expect(dialog.open).toBe(false)
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="meal-item"]')).toHaveLength(2)
  })

  it('deletes the meal when the confirm dialog is confirmed', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper } = await mountAt('/meals')
    await wrapper.findAll('[data-testid="meal-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/meals/1', undefined)
    expect(wrapper.findAll('[data-testid="meal-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Grilled Fish')
    expect(useSuccessMessage().message.value).toMatch(/deleted/i)
  })

  it('shows a blocked-delete error inline without removing the meal', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockRejectedValue(new ApiError(409, 'meal_in_use'))

    const { wrapper } = await mountAt('/meals')
    await wrapper.findAll('[data-testid="meal-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toMatch(/meal pairing/i)
    expect(wrapper.findAll('[data-testid="meal-item"]')).toHaveLength(2)
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
