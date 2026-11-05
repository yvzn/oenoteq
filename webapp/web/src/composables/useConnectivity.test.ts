import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { useConnectivity } from './useConnectivity'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function mountConnectivity() {
  return mount({
    setup() {
      return useConnectivity()
    },
    template: '<div />',
  })
}

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

describe('useConnectivity', () => {
  it('is online once the initial /health check succeeds', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    const wrapper = mountConnectivity()
    await flushPromises()

    expect(wrapper.vm.isOnline).toBe(true)
  })

  it('is offline when the browser reports no network interface, without even checking /health', async () => {
    setNavigatorOnLine(false)
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    const wrapper = mountConnectivity()
    await flushPromises()

    expect(wrapper.vm.isOnline).toBe(false)
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is offline when the network interface is up but the health check fails (home PC unreachable)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error: unable to reach the server'))

    const wrapper = mountConnectivity()
    await flushPromises()

    expect(wrapper.vm.isOnline).toBe(false)
  })

  it('flips back online once a browser "online" event is followed by a successful health check', async () => {
    setNavigatorOnLine(false)
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    const wrapper = mountConnectivity()
    await flushPromises()
    expect(wrapper.vm.isOnline).toBe(false)

    setNavigatorOnLine(true)
    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(wrapper.vm.isOnline).toBe(true)
  })

  it('flips offline immediately on a browser "offline" event, without waiting on a health check', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    const wrapper = mountConnectivity()
    await flushPromises()
    expect(wrapper.vm.isOnline).toBe(true)

    window.dispatchEvent(new Event('offline'))

    expect(wrapper.vm.isOnline).toBe(false)
  })
})
