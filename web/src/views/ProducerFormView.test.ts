import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { ApiError, apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { db } from '../db/localDb'
import { enqueue } from '../sync/outbox'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import ProducerFormView from './ProducerFormView.vue'
import ProducerListView from './ProducerListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const producers = [
  { id: 1, name: 'Domaine du Closel' },
  { id: 2, name: 'Chateau Test' },
]

function mockGet(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === '/producers') return Promise.resolve(overrides.producers ?? producers)
    throw new Error(`unexpected path: ${path}`)
  })
}

function makeRouter(): Router {
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/producers', name: 'producers', component: ProducerListView },
        { path: '/producers/new', name: 'producer-new', component: ProducerFormView },
        { path: '/producers/:id/edit', name: 'producer-edit', component: ProducerFormView },
      ],
    }),
  )
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(ProducerFormView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.put).mockReset()
})

resetSuccessMessageAfterEach()

describe('ProducerFormView — add', () => {
  it('shows a blank form ready to submit a new producer', async () => {
    const { wrapper } = await mountAt('/producers/new')

    expect(wrapper.text()).toContain('Add producer')
    expect((wrapper.get('[data-testid="producer-name-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('blocks submit and shows a field error when the name is blank', async () => {
    const { wrapper } = await mountAt('/producers/new')
    await wrapper.get('[data-testid="producer-form"]').trigger('submit.prevent')

    expect(wrapper.find('[data-testid="producer-name-error"]').exists()).toBe(true)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('submits a POST and navigates to the producer list on success', async () => {
    vi.mocked(apiClient.post).mockImplementation((path: string, body: unknown) => {
      if (path === '/producers') return Promise.resolve({ id: 3, ...(body as object) })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/producers/new')
    await wrapper.get('[data-testid="producer-name-input"]').setValue('Domaine Nouveau')
    await wrapper.get('[data-testid="producer-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.post).toHaveBeenCalledWith('/producers', {
      name: 'Domaine Nouveau',
      client_id: expect.any(String),
    })
    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/producers')
  })

  it('saves and navigates even when the background sync to the backend is rejected, leaving the item failed in the outbox', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('already_exists'))

    const { wrapper, router } = await mountAt('/producers/new')
    await wrapper.get('[data-testid="producer-name-input"]').setValue('Domaine du Closel')
    await wrapper.get('[data-testid="producer-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/added/i)
    expect(router.currentRoute.value.fullPath).toBe('/producers')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'producer', action: 'create', status: 'failed' })
  })

  it('navigates to the producer list when cancel is clicked', async () => {
    const { wrapper, router } = await mountAt('/producers/new')
    await wrapper.get('[data-testid="producer-form-cancel"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/producers')
  })
})

describe('ProducerFormView — edit', () => {
  it('pre-fills the form with the existing producer name once the list loads', async () => {
    mockGet()

    const { wrapper } = await mountAt('/producers/2/edit')

    expect(wrapper.text()).toContain('Rename producer')
    expect((wrapper.get('[data-testid="producer-name-input"]').element as HTMLInputElement).value).toBe(
      'Chateau Test',
    )
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/producers/2/edit')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="producer-form-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="producer-form"]').exists()).toBe(true)
  })

  it('submits a PUT and navigates to the producer list on success', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockImplementation((path: string) => {
      if (path === '/producers/2') return Promise.resolve({ id: 2, name: 'Chateau Renamed' })
      throw new Error(`unexpected path: ${path}`)
    })

    const { wrapper, router } = await mountAt('/producers/2/edit')
    await wrapper.get('[data-testid="producer-name-input"]').setValue('Chateau Renamed')
    await wrapper.get('[data-testid="producer-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(apiClient.put).toHaveBeenCalledWith('/producers/2', { name: 'Chateau Renamed' })
    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/producers')
  })

  it('saves and navigates even with the network fully disabled, leaving the edit queued and pending', async () => {
    mockGet()
    vi.mocked(apiClient.put).mockRejectedValue(new ApiError(0, 'Network error: unable to reach the server'))

    const { wrapper, router } = await mountAt('/producers/2/edit')
    await wrapper.get('[data-testid="producer-name-input"]').setValue('Chateau Renamed')
    await wrapper.get('[data-testid="producer-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(useSuccessMessage().message.value).toMatch(/updated/i)
    expect(router.currentRoute.value.fullPath).toBe('/producers')
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'producer', action: 'update', status: 'pending' })
  })

  it('navigates to the producer list when cancel is clicked', async () => {
    mockGet()

    const { wrapper, router } = await mountAt('/producers/2/edit')
    await wrapper.get('[data-testid="producer-form-cancel"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/producers')
  })

  it('shows a "not yet synced" badge while this producer still has a queued edit in the outbox', async () => {
    mockGet()
    await enqueue(db.outbox, { entity: 'producer', action: 'update', targetId: 2, payload: { name: 'x' } })

    const { wrapper } = await mountAt('/producers/2/edit')

    expect(wrapper.find('[data-testid="sync-pending-badge"]').exists()).toBe(true)
  })

  it('hides the "not yet synced" badge once nothing is queued for this producer', async () => {
    mockGet()

    const { wrapper } = await mountAt('/producers/2/edit')

    expect(wrapper.find('[data-testid="sync-pending-badge"]').exists()).toBe(false)
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
