import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startBackgroundServices } from './boot'
import { reloadInto } from './consent/reload'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'
import { CONSENT_STORAGE_KEY } from './consent/storageConsent'
import { setConsent } from './test/consent'

vi.mock('./consent/reload', () => ({ reloadInto: vi.fn() }))
vi.mock('./registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('./sync', () => ({ startSync: vi.fn() }))

let openSpy: ReturnType<typeof vi.spyOn>
let fetchSpy: ReturnType<typeof vi.fn>
const stops: (() => void)[] = []

function start() {
  stops.push(startBackgroundServices())
}

beforeEach(() => {
  openSpy = vi.spyOn(indexedDB, 'open')
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">'
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  vi.mocked(reloadInto).mockClear()
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

      start()

      expect(openSpy).not.toHaveBeenCalled()
      expect(registerPwaUpdates).not.toHaveBeenCalled()
      expect(startSync).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it.each(['refused', 'no-choice'] as const)('with %s, offers no app install', (state) => {
    setConsent(state)

    start()

    expect(document.querySelector('link[rel="manifest"]')).toBeNull()
  })

  it('with granted, starts sync and registers the service worker as before', () => {
    setConsent('granted')

    start()

    expect(startSync).toHaveBeenCalledOnce()
    expect(registerPwaUpdates).toHaveBeenCalledOnce()
    expect(document.querySelector('link[rel="manifest"]')).not.toBeNull()
  })

  describe('a consent change in another tab', () => {
    function otherTabChooses(state: 'granted' | 'refused') {
      setConsent(state)
      window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY }))
    }

    it.each(['granted', 'refused'] as const)('reloads this tab into the new mode, from %s', (booted) => {
      setConsent(booted)
      start()
      history.replaceState(null, '', '/manage?x=1#top')

      otherTabChooses(booted === 'granted' ? 'refused' : 'granted')

      expect(reloadInto).toHaveBeenCalledWith('/manage?x=1#top')
    })

    it('reloads a tab waiting on the consent page once the other tab chooses', () => {
      setConsent('no-choice')
      start()
      otherTabChooses('refused')
      expect(reloadInto).toHaveBeenCalledOnce()
    })

    it('leaves the tab alone when the record still matches the mode it booted in', () => {
      setConsent('granted')
      start()
      otherTabChooses('granted')
      expect(reloadInto).not.toHaveBeenCalled()
    })

    it('ignores other storage keys', () => {
      setConsent('granted')
      start()
      setConsent('refused')
      window.dispatchEvent(new StorageEvent('storage', { key: 'cellar.locale' }))
      expect(reloadInto).not.toHaveBeenCalled()
    })
  })
})
