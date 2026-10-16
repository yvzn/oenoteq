import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { apiClient } from '../api/client'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { useSyncStatus } from '../composables/useSyncStatus'
import { db } from '../db/localDb'
import { syncNow } from '../sync'
import { enqueue } from '../sync/outbox'
import { setConsent } from '../test/consent'
import { setTestLocale } from '../test/i18n'
import AppHeader from './AppHeader.vue'

vi.mock('../sync', async () => {
  const actual = await vi.importActual<typeof import('../sync')>('../sync')
  return { ...actual, pushChangesInBackground: vi.fn(), syncNow: vi.fn() }
})

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const stub = { template: '<div />' }

const setNavigatorOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })

beforeEach(() => {
  vi.mocked(syncNow).mockReset()
  vi.mocked(syncNow).mockResolvedValue()
  vi.mocked(apiClient.get).mockResolvedValue({})
})

afterEach(() => {
  setNavigatorOnLine(true)
  useSuccessMessage().clear()
})

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: stub },
      { path: '/wines/:id', name: 'wine-detail', component: stub },
      { path: '/manage', name: 'manage', component: stub },
      { path: '/meals', name: 'meals', component: stub },
      { path: '/appellations', name: 'appellations', component: stub },
      { path: '/meal-pairings', name: 'meal-pairings', component: stub },
      { path: '/sync-status', name: 'sync-status', component: stub },
      { path: '/storage', name: 'storage', component: stub },
    ],
  })
}

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  // Shared status state doesn't see the db reset or direct outbox writes between tests.
  await useSyncStatus().refresh()
  const wrapper = mount(AppHeader, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const pill = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="sync-pill"]')

async function queueChange() {
  await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })
}

async function queueFailedChange() {
  const id = await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: {} })
  await db.outbox.update(id, { status: 'failed', error: 'already_exists' })
}

describe('AppHeader', () => {
  it('shows exactly Cellar and Manage as top-level nav items', async () => {
    const { wrapper } = await mountAt('/')

    const nav = wrapper.get('nav')
    expect(nav.text()).not.toContain('Meal pairings')

    const links = nav.findAll('a')
    expect(links.map((link) => link.text())).toEqual(['Cellar', 'Manage'])
    expect(links[1]!.attributes('href')).toBe('/manage')
  })

  it('highlights Manage when on a management subpage', async () => {
    const { wrapper } = await mountAt('/meals')

    const manageLink = wrapper.get('nav').findAll('a')[1]!
    expect(manageLink.classes()).toContain('text-bordeaux')
  })
})

describe('AppHeader sync pill', () => {
  it('shows a quiet Synced when nothing is pending', async () => {
    const { wrapper } = await mountAt('/')

    expect(pill(wrapper).text()).toBe('Synced')
    expect(pill(wrapper).attributes('href')).toBe('/sync-status')
  })

  it('counts queued changes, singular and plural', async () => {
    await queueChange()
    expect(pill((await mountAt('/')).wrapper).text()).toBe('1 change to sync')

    await queueChange()
    expect(pill((await mountAt('/')).wrapper).text()).toBe('2 changes to sync')
  })

  it('says Offline with the saved count while offline', async () => {
    setNavigatorOnLine(false)
    await queueChange()
    await queueChange()

    const { wrapper } = await mountAt('/')

    expect(pill(wrapper).text()).toBe('Offline · 2 changes saved')
  })

  it('says just Offline when offline with nothing saved', async () => {
    setNavigatorOnLine(false)

    const { wrapper } = await mountAt('/')

    expect(pill(wrapper).text()).toBe('Offline')
  })

  it('says Syncing… while a sync runs', async () => {
    await queueChange()
    let release!: () => void
    vi.mocked(syncNow).mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
    const { wrapper } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await flushPromises()
    expect(pill(wrapper).text()).toBe('Syncing…')

    release()
    await flushPromises()
  })

  it('offers Retry for a failed change while online', async () => {
    await queueFailedChange()

    const { wrapper } = await mountAt('/')

    expect(pill(wrapper).text()).toBe('Sync failed · Retry')
  })

  it('drops Retry for a failed change while offline', async () => {
    setNavigatorOnLine(false)
    await queueFailedChange()

    const { wrapper } = await mountAt('/')

    expect(pill(wrapper).text()).toBe('Sync failed')
  })

  it('shows failed over offline over pending', async () => {
    setNavigatorOnLine(false)
    await queueChange()
    await queueFailedChange()
    expect(pill((await mountAt('/')).wrapper).text()).toBe('Sync failed')

    await db.outbox.clear()
    await queueChange()
    expect(pill((await mountAt('/')).wrapper).text()).toBe('Offline · 1 change saved')
  })

  it('opens the page and starts one sync from "N changes to sync", even when clicked twice', async () => {
    await queueChange()
    let release!: () => void
    vi.mocked(syncNow).mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
    const { wrapper, router } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await pill(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('sync-status')
    expect(syncNow).toHaveBeenCalledTimes(1)

    release()
    await flushPromises()
  })

  it('opens the page and retries from "Sync failed · Retry"', async () => {
    await queueFailedChange()
    const { wrapper, router } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('sync-status')
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('only opens the page when failed while offline', async () => {
    setNavigatorOnLine(false)
    await queueFailedChange()
    const { wrapper, router } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('sync-status')
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('only opens the page when synced', async () => {
    const { wrapper, router } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('sync-status')
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('never raises a toast when sync fails', async () => {
    await queueChange()
    vi.mocked(syncNow).mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountAt('/')

    await pill(wrapper).trigger('click')
    await flushPromises()

    expect(useSuccessMessage().message.value).toBeNull()
  })
})

describe('AppHeader language toggle', () => {
  const option = (wrapper: ReturnType<typeof mount>, code: 'en' | 'fr') => wrapper.get(`[data-testid="language-${code}"]`)

  it('shows plain FR | EN with the active language marked', async () => {
    const { wrapper } = await mountAt('/')

    const toggle = wrapper.get('[data-testid="language-toggle"]')
    expect(toggle.text()).toBe('FR|EN')
    expect(option(wrapper, 'en').attributes('aria-pressed')).toBe('true')
    expect(option(wrapper, 'fr').attributes('aria-pressed')).toBe('false')
    expect(option(wrapper, 'en').classes()).toContain('font-bold')
    expect(option(wrapper, 'fr').classes()).not.toContain('font-bold')
  })

  it('names each option in its own language', async () => {
    const { wrapper } = await mountAt('/')

    expect(option(wrapper, 'en').attributes('aria-label')).toBe('English')
    expect(option(wrapper, 'en').attributes('lang')).toBe('en')
    expect(option(wrapper, 'fr').attributes('aria-label')).toBe('Français')
    expect(option(wrapper, 'fr').attributes('lang')).toBe('fr')
  })

  it('switches the header to French in place, then back', async () => {
    const { wrapper } = await mountAt('/')

    await option(wrapper, 'fr').trigger('click')
    expect(wrapper.get('nav').findAll('a').map((link) => link.text())).toEqual(['Cave', 'Gérer'])
    expect(option(wrapper, 'fr').attributes('aria-pressed')).toBe('true')
    expect(option(wrapper, 'fr').classes()).toContain('font-bold')

    await option(wrapper, 'en').trigger('click')
    expect(wrapper.get('nav').findAll('a').map((link) => link.text())).toEqual(['Cellar', 'Manage'])
  })
})

describe('AppHeader storage link', () => {
  it.each(['granted', 'refused'] as const)('leads to the change-of-choice screen with %s', async (choice) => {
    setConsent(choice)
    const { wrapper } = await mountAt('/')
    expect(wrapper.get('[data-testid="storage-link"]').attributes('href')).toBe('/storage')
  })
})

describe('AppHeader without Offline Mode', () => {
  it('never shows the sync pill', async () => {
    await queueChange()
    setConsent('refused')

    const { wrapper } = await mountAt('/')

    expect(wrapper.find('[data-testid="sync-pill"]').exists()).toBe(false)
  })
})

describe('AppHeader in French', () => {
  it('shows the nav, tagline and sync pill in French', async () => {
    setTestLocale('fr')
    await queueChange()

    const { wrapper } = await mountAt('/')

    expect(wrapper.get('nav').findAll('a').map((link) => link.text())).toEqual(['Cave', 'Gérer'])
    expect(wrapper.get('h1').text()).toBe('Suivi de cave à vin')
    expect(pill(wrapper).text()).toBe('1 modification à synchroniser')
  })
})
