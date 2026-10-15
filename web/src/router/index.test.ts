import { describe, expect, it } from 'vitest'
import { setConsent } from '../test/consent'
import router from './index'

describe('router sync-status route', () => {
  it('opens the sync page in Offline Mode', async () => {
    setConsent('granted')

    await router.push('/sync-status')

    expect(router.currentRoute.value.name).toBe('sync-status')
  })

  it.each(['refused', 'no-choice'] as const)('redirects away to the cellar with %s', async (state) => {
    await router.push('/manage')
    setConsent(state)

    await router.push('/sync-status')

    expect(router.currentRoute.value.name).toBe('cellar')
  })
})
