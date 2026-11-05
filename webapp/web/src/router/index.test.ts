import { describe, expect, it, vi } from 'vitest'
import { setConsent } from '../test/consent'
import router from './index'

// The consent page registers the service worker; its virtual module only exists in a real build.
vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))

describe('router sync-status route', () => {
  it('opens the sync page in Offline Mode', async () => {
    setConsent('granted')

    await router.push('/sync-status')

    expect(router.currentRoute.value.name).toBe('sync-status')
  })

  it('redirects away to the cellar when refused', async () => {
    await router.push('/manage')
    setConsent('refused')

    await router.push('/sync-status')

    expect(router.currentRoute.value.name).toBe('cellar')
  })
})
