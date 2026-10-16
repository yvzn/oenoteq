import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { setConsent } from '../test/consent'
import { setTestLocale } from '../test/i18n'
import OfflineToast from './OfflineToast.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const setNavigatorOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
  setNavigatorOnLine(true)
  useSuccessMessage().clear()
})

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

async function mountNotifier() {
  const wrapper = mount(OfflineToast)
  await flushPromises()
  return wrapper
}

function queued(): string[] {
  const { message, dismiss } = useSuccessMessage()
  const texts: string[] = []
  while (message.value !== null) {
    texts.push(message.value)
    dismiss()
  }
  return texts
}

async function goOffline() {
  setNavigatorOnLine(false)
  window.dispatchEvent(new Event('offline'))
  await flushPromises()
}

async function goOnline() {
  setNavigatorOnLine(true)
  vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })
  window.dispatchEvent(new Event('online'))
  await flushPromises()
}

describe('OfflineToast', () => {
  it('shows nothing while online', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })

    await mountNotifier()

    expect(queued()).toEqual([])
  })

  it('queues the saved-locally message once when the connection drops', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })
    await mountNotifier()

    await goOffline()

    expect(queued()).toEqual(["No network — changes are saved locally and will sync when you're back online."])
  })

  it('queues nothing when the connection returns, and leaves the toast up', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })
    await mountNotifier()
    await goOffline()

    await goOnline()

    expect(useSuccessMessage().message.value).toContain('No network')
    expect(queued()).toHaveLength(1)
  })

  it('queues one toast per drop', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'ok' })
    await mountNotifier()

    await goOffline()
    await goOnline()
    await goOffline()

    expect(queued()).toHaveLength(2)
  })

  it('toasts when the app starts offline', async () => {
    setNavigatorOnLine(false)

    await mountNotifier()

    expect(queued()).toHaveLength(1)
  })

  it('says it in French', async () => {
    setTestLocale('fr')
    setNavigatorOnLine(false)

    await mountNotifier()

    expect(queued()[0]).toContain('les modifications sont enregistrées localement')
  })
})

describe.each(['refused', 'no-choice'] as const)('OfflineToast without Offline Mode (%s)', (state) => {
  it("says changes can't be saved and does not claim local saving", async () => {
    setConsent(state)
    setNavigatorOnLine(false)

    await mountNotifier()

    const [text] = queued()
    expect(text).toContain("changes can't be saved")
    expect(text).not.toContain('saved locally')
  })
})
