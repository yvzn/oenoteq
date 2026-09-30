import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import OfflineBanner from './OfflineBanner.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const setNavigatorOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  setNavigatorOnLine(true)
})

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: { template: '<div />' } },
      { path: '/sync-status', name: 'sync-status', component: { template: '<div />' } },
    ],
  })
}

async function mountBanner() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(OfflineBanner, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('OfflineBanner', () => {
  it('is hidden while online', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    const { wrapper } = await mountBanner()

    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false)
  })

  it('shows with no dismiss control once the network is confirmed unreachable', async () => {
    setNavigatorOnLine(false)

    const { wrapper } = await mountBanner()

    const banner = wrapper.get('[data-testid="offline-banner"]')
    expect(banner.text()).toContain("No network — changes are saved locally and will sync when you're back online.")
    expect(wrapper.find('button:not([data-testid="offline-banner"])').exists()).toBe(false)
  })

  it('disappears the instant connectivity is confirmed restored', async () => {
    setNavigatorOnLine(false)
    const { wrapper } = await mountBanner()
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true)

    setNavigatorOnLine(true)
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })
    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false)
  })

  it('navigates to the sync-status page when clicked', async () => {
    setNavigatorOnLine(false)
    const { wrapper, router } = await mountBanner()

    await wrapper.get('[data-testid="offline-banner"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('sync-status')
  })
})
