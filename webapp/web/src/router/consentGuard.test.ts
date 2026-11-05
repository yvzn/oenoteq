import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { setConsent } from '../test/consent'
import { createAppRouter } from '.'
import { safeDestination } from './consentGuard'

// The consent page registers the service worker; its virtual module only exists in a real build.
vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))


function memoryRouter() {
  return createAppRouter(createMemoryHistory())
}

describe('consent gate', () => {
  it('sends every route to the consent page while there is no choice', async () => {
    setConsent('no-choice')
    const router = memoryRouter()
    const paths = router
      .getRoutes()
      .filter((r) => r.name !== 'consent')
      .map((r) => r.path.replace(':id', '7'))
    expect(paths.length).toBeGreaterThan(10)
    for (const path of paths) {
      await router.push(path)
      expect(router.currentRoute.value.name, path).toBe('consent')
    }
  })

  it('remembers the intended destination, query included', async () => {
    setConsent('no-choice')
    const router = memoryRouter()
    await router.push('/wines/7?tab=history')
    expect(router.currentRoute.value.query.redirect).toBe('/wines/7?tab=history')
  })

  it('leaves routes alone once a choice exists, and sends the consent page onward', async () => {
    for (const choice of ['granted', 'refused'] as const) {
      setConsent(choice)
      const router = memoryRouter()
      await router.push('/manage')
      expect(router.currentRoute.value.name).toBe('manage')
      await router.push('/consent?redirect=/meals')
      expect(router.currentRoute.value.fullPath).toBe('/meals')
    }
  })

  it('never follows a destination that leaves the site', () => {
    expect(safeDestination('//evil.example')).toBe('/')
    expect(safeDestination('/\\evil.example')).toBe('/')
    expect(safeDestination('/\t/evil.example')).toBe('/')
    expect(safeDestination('https://evil.example')).toBe('/')
    expect(safeDestination(undefined)).toBe('/')
    expect(safeDestination('/wines/3')).toBe('/wines/3')
  })
})

