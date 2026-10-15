import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startBackgroundServices } from './boot'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'
import { setConsent } from './test/consent'

vi.mock('./registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('./sync', () => ({ startSync: vi.fn() }))

let openSpy: ReturnType<typeof vi.spyOn>
let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  openSpy = vi.spyOn(indexedDB, 'open')
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">'
})

afterEach(() => {
  vi.unstubAllGlobals()
  openSpy.mockRestore()
  vi.mocked(startSync).mockClear()
  vi.mocked(registerPwaUpdates).mockClear()
})

describe('boot', () => {
  it.each(['refused', 'no-choice'] as const)(
    'with %s, opens no local store, registers no service worker, starts no sync and sends no request',
    (state) => {
      setConsent(state)

      startBackgroundServices()

      expect(openSpy).not.toHaveBeenCalled()
      expect(registerPwaUpdates).not.toHaveBeenCalled()
      expect(startSync).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it.each(['refused', 'no-choice'] as const)('with %s, offers no app install', (state) => {
    setConsent(state)

    startBackgroundServices()

    expect(document.querySelector('link[rel="manifest"]')).toBeNull()
  })

  it('with granted, starts sync and registers the service worker as before', () => {
    setConsent('granted')

    startBackgroundServices()

    expect(startSync).toHaveBeenCalledOnce()
    expect(registerPwaUpdates).toHaveBeenCalledOnce()
    expect(document.querySelector('link[rel="manifest"]')).not.toBeNull()
  })
})
