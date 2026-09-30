import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { ApiError, apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { db } from '../db/localDb'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import AppellationFormView from './AppellationFormView.vue'
import AppellationListView from './AppellationListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const appellations = [
  { id: 1, name: 'Chablis' },
  { id: 2, name: 'Sancerre' },
]

function mockGet(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/appellations') return Promise.resolve(overrides.appellations ?? appellations)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/appellations', name: 'appellations', component: AppellationListView },
        { path: '/appellations/new', name: 'appellation-new', component: AppellationFormView },
        { path: '/appellations/:id/edit', name: 'appellation-edit', component: AppellationFormView },
      ],
    }),
  )
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(AppellationFormView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

resetSuccessMessageAfterEach()

describe('AppellationFormView — add', () => {
  it('shows a blank form ready to submit a new appellation', async () => {
    const { wrapper } = await mountAt('/appellations/new')

    expect(wrapper.text()).toContain('Add appellation')
    expect((wrapper.get('[data-testid="appellation-name-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('blocks submit and shows a field error when the name is blank', async () => {
    const { wrapper } = await mountAt('/appellations/new')
    await wrapper.get('[data-testid="appellation-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="appellation-name-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('submits a POST and navigates to the appellation list on success', async () => {
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/appellations') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/appellations/new')
    await wrapper.get('[data-testid="appellation-name-input"]').setValue('Pouilly-Fumé')
    await wrapper.get('[data-testid="appellation-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/appellations', {
      name: 'Pouilly-Fumé',
      client_id: expect.any(String),
    })
    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/appellations')
  })

  it('saves and navigates even when the background sync to the backend is rejected, leaving the item failed in the outbox', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('already_exists'))

    const { wrapper, router } = await mountAt('/appellations/new')
    await wrapper.get('[data-testid="appellation-name-input"]').setValue('Chablis')
    await wrapper.get('[data-testid="appellation-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/appellations')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'appellation', action: 'create', status: 'failed' })
  })
})

describe('AppellationFormView — edit', () => {
  it('pre-fills the form with the existing appellation name once the list loads', async () => {
    mockGet()

    const { wrapper } = await mountAt('/appellations/2/edit')

    expect(wrapper.text()).toContain('Rename appellation')
    expect((wrapper.get('[data-testid="appellation-name-input"]').element as HTMLInputElement).value).toBe(
      'Sancerre',
    )
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/appellations/2/edit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="appellation-form-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="appellation-form"]').exists()).toBe(true)
  })

  it('submits a PUT and navigates to the appellation list on success', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockImplementation((path: string) => {
      if (path === '/appellations/2') return Promise.resolve({ id: 2, name: 'Sancerre Rouge' })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/appellations/2/edit')
    await wrapper.get('[data-testid="appellation-name-input"]').setValue('Sancerre Rouge')
    await wrapper.get('[data-testid="appellation-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.put).toHaveBeenCalledWith('/appellations/2', { name: 'Sancerre Rouge' })
    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/appellations')
  })

  it('saves and navigates even with the network fully disabled, leaving the edit queued and pending', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockRejectedValue(new ApiError(0, 'Network error: unable to reach the server'))

    const { wrapper, router } = await mountAt('/appellations/2/edit')
    await wrapper.get('[data-testid="appellation-name-input"]').setValue('Sancerre Rouge')
    await wrapper.get('[data-testid="appellation-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/appellations')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'appellation', action: 'update', status: 'pending' })
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
