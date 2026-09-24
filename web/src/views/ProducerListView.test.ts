import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient, ApiError } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
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

  const wrapper = mount(ProducerListView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

resetSuccessMessageAfterEach()

describe('ProducerListView', () => {
  it('lists all producers with links to rename and add', async () => {
    mockGet()

    const { wrapper } = await mountAt('/producers')

    const items = wrapper.findAll('[data-testid="producer-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('Domaine du Closel')
    expect(wrapper.text()).toContain('Chateau Test')
    expect(wrapper.find('[data-testid="add-producer-link"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="producer-rename-link"]')).toHaveLength(2)
  })

  it('shows an empty state when there are no producers', async () => {
    mockGet({ producers: [] })

    const { wrapper } = await mountAt('/producers')

    expect(wrapper.text()).toContain('No producers yet.')
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/producers')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="producer-list-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="producer-list"]').exists()).toBe(true)
  })

  it('opens the confirm dialog on delete and does nothing on cancel', async () => {
    mockGet()

    const { wrapper } = await mountAt('/producers')
    await wrapper.findAll('[data-testid="producer-delete-button"]')[0]!.trigger('click')

    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Delete producer "Domaine du Closel"?')

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()

    expect(dialog.open).toBe(false)
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="producer-item"]')).toHaveLength(2)
  })

  it('deletes the producer when the confirm dialog is confirmed', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper } = await mountAt('/producers')
    await wrapper.findAll('[data-testid="producer-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/producers/1', undefined)
    expect(wrapper.findAll('[data-testid="producer-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Chateau Test')
    expect(useSuccessMessage().message.value).toMatch(/deleted/i)
  })

  it('shows a blocked-delete error inline without removing the producer', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockRejectedValue(new ApiError(409, 'producer_in_use'))

    const { wrapper } = await mountAt('/producers')
    await wrapper.findAll('[data-testid="producer-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toMatch(/used by a wine/i)
    expect(wrapper.findAll('[data-testid="producer-item"]')).toHaveLength(2)
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
