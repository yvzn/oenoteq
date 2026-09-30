import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { ApiError, apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { db } from '../db/localDb'
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

  const wrapper = mount(MealFormView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

resetSuccessMessageAfterEach()

describe('MealFormView — add', () => {
  it('shows a blank form ready to submit a new meal', async () => {
    const { wrapper } = await mountAt('/meals/new')

    expect(wrapper.text()).toContain('Add meal')
    expect((wrapper.get('[data-testid="meal-name-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('blocks submit and shows a field error when the name is blank', async () => {
    const { wrapper } = await mountAt('/meals/new')
    await wrapper.get('[data-testid="meal-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="meal-name-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('submits a POST and navigates to the meal list on success', async () => {
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/meals') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/meals/new')
    await wrapper.get('[data-testid="meal-name-input"]').setValue('Roast Chicken')
    await wrapper.get('[data-testid="meal-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/meals', {
      name: 'Roast Chicken',
      client_id: expect.any(String),
    })
    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/meals')
  })

  it('saves and navigates even when the background sync to the backend is rejected, leaving the item failed in the outbox', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('already_exists'))

    const { wrapper, router } = await mountAt('/meals/new')
    await wrapper.get('[data-testid="meal-name-input"]').setValue('Oysters')
    await wrapper.get('[data-testid="meal-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/meals')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'meal', action: 'create', status: 'failed' })
  })

  it('navigates to the meal list when cancel is clicked', async () => {
    const { wrapper, router } = await mountAt('/meals/new')
    await wrapper.get('[data-testid="meal-form-cancel"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/meals')
  })
})

describe('MealFormView — edit', () => {
  it('pre-fills the form with the existing meal name once the list loads', async () => {
    mockGet()

    const { wrapper } = await mountAt('/meals/2/edit')

    expect(wrapper.text()).toContain('Rename meal')
    expect((wrapper.get('[data-testid="meal-name-input"]').element as HTMLInputElement).value).toBe(
      'Grilled Fish',
    )
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/meals/2/edit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="meal-form-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="meal-form"]').exists()).toBe(true)
  })

  it('submits a PUT and navigates to the meal list on success', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockImplementation((path: string) => {
      if (path === '/meals/2') return Promise.resolve({ id: 2, name: 'Grilled Salmon' })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/meals/2/edit')
    await wrapper.get('[data-testid="meal-name-input"]').setValue('Grilled Salmon')
    await wrapper.get('[data-testid="meal-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.put).toHaveBeenCalledWith('/meals/2', { name: 'Grilled Salmon' })
    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/meals')
  })

  it('saves and navigates even with the network fully disabled, leaving the edit queued and pending', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockRejectedValue(new ApiError(0, 'Network error: unable to reach the server'))

    const { wrapper, router } = await mountAt('/meals/2/edit')
    await wrapper.get('[data-testid="meal-name-input"]').setValue('Grilled Salmon')
    await wrapper.get('[data-testid="meal-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/meals')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'meal', action: 'update', status: 'pending' })
  })

  it('navigates to the meal list when cancel is clicked', async () => {
    mockGet()

    const { wrapper, router } = await mountAt('/meals/2/edit')
    await wrapper.get('[data-testid="meal-form-cancel"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/meals')
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
