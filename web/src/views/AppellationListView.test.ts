import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient, ApiError } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
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

  const wrapper = mount(AppellationListView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

resetSuccessMessageAfterEach()

describe('AppellationListView', () => {
  it('lists all appellations with links to rename and add', async () => {
    mockGet()

    const { wrapper } = await mountAt('/appellations')

    const items = wrapper.findAll('[data-testid="appellation-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('Chablis')
    expect(wrapper.text()).toContain('Sancerre')
    expect(wrapper.find('[data-testid="add-appellation-link"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="appellation-rename-link"]')).toHaveLength(2)
  })

  it('shows an empty state when there are no appellations', async () => {
    mockGet({ appellations: [] })

    const { wrapper } = await mountAt('/appellations')

    expect(wrapper.text()).toContain('No appellations yet.')
  })

  it('retries the failed load when the retry action is clicked', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('server exploded'))

    const { wrapper } = await mountAt('/appellations')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    mockGet()
    await wrapper.get('[data-testid="appellation-list-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="appellation-list"]').exists()).toBe(true)
  })

  it('opens the confirm dialog on delete and does nothing on cancel', async () => {
    mockGet()

    const { wrapper } = await mountAt('/appellations')
    await wrapper.findAll('[data-testid="appellation-delete-button"]')[0]!.trigger('click')

    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Delete appellation "Chablis"?')

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()

    expect(dialog.open).toBe(false)
    expect(apiClient.delete).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="appellation-item"]')).toHaveLength(2)
  })

  it('deletes the appellation when the confirm dialog is confirmed', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    const { wrapper } = await mountAt('/appellations')
    await wrapper.findAll('[data-testid="appellation-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/appellations/1', undefined)
    expect(wrapper.findAll('[data-testid="appellation-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Sancerre')
    expect(useSuccessMessage().message.value).toMatch(/deleted/i)
  })

  it('shows a blocked-delete error inline without removing the appellation', async () => {
    mockGet()
    vi.mocked(apiClient.delete).mockRejectedValue(new ApiError(409, 'appellation_in_use'))

    const { wrapper } = await mountAt('/appellations')
    await wrapper.findAll('[data-testid="appellation-delete-button"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toMatch(/wine or a meal pairing/i)
    expect(wrapper.findAll('[data-testid="appellation-item"]')).toHaveLength(2)
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
