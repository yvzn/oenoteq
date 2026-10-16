import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { CONSENT_STORAGE_KEY, readConsent } from '../consent/storageConsent'
import { deleteLocalData } from '../consent/deleteLocalData'
import { reloadInto } from '../consent/reload'
import { db } from '../db/localDb'
import { LOCALE_STORAGE_KEY } from '../i18n/localePreference'
import { registerPwaUpdates } from '../registerPwa'
import { createAppRouter } from '../router'
import { syncNow } from '../sync'
import { enqueue } from '../sync/outbox'
import { setConsent } from '../test/consent'
import App from '../App.vue'

vi.mock('../consent/reload', () => ({ reloadInto: vi.fn() }))
vi.mock('../consent/deleteLocalData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../consent/deleteLocalData')>()),
  deleteLocalData: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('../sync', () => ({ syncNow: vi.fn(), startSync: vi.fn() }))

let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  setConsent('no-choice')
  await db.delete() // a first visit: no local store yet
  openSpy = vi.spyOn(indexedDB, 'open')
  vi.mocked(syncNow).mockReset().mockResolvedValue(undefined)
  vi.mocked(reloadInto).mockClear()
  vi.mocked(registerPwaUpdates).mockClear()
  vi.mocked(deleteLocalData).mockClear()
})

afterEach(async () => {
  openSpy.mockRestore()
  await db.open() // the shared store is closed by the first-visit setup; other hooks clear it
})

async function mountAt(path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return wrapper
}

describe('ConsentView', () => {
  it('is a full page with two unselected one-tap choices, refusing outlined at the same size, any route landing on it', async () => {
    const wrapper = await mountAt('/wines/7')
    const allow = wrapper.get('[data-testid="consent-allow"]')
    const refuse = wrapper.get('[data-testid="consent-refuse"]')
    for (const choice of [allow, refuse]) {
      expect(choice.element.tagName).toBe('BUTTON')
      expect(choice.attributes('disabled')).toBeUndefined()
    }
    expect(allow.classes()).toEqual(expect.arrayContaining(['bg-bordeaux', 'px-5', 'py-3']))
    // Outlined, with primary's footprint: padding 1px short to fit the border.
    expect(refuse.classes()).toEqual(expect.arrayContaining(['border', 'px-[19px]', 'py-[11px]']))
    expect(wrapper.find('[role="dialog"], dialog').exists()).toBe(false)
    expect(wrapper.findAll('input[type="radio"], input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.find('nav').exists()).toBe(false) // the rest of the app is not reachable
  })

  it('leads with cookies and no tracking, labelling each choice by its outcome', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.get('h2').text()).toBe('Cookies? Only one kind.')
    expect(wrapper.text()).toContain('No ads. No tracking.')
    expect(wrapper.get('[data-testid="consent-allow"]').text()).toBe('Allow offline mode')
    expect(wrapper.get('[data-testid="consent-refuse"]').text()).toBe('Online only')
    expect(wrapper.text()).toContain('Cookie preferences')
  })

  it('folds what is stored, what refusing costs and sign-in into a closed disclosure', async () => {
    const details = (await mountAt('/')).get('[data-testid="consent-details"]')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toBe('What exactly is saved?')
    for (const part of ['Your wines', 'Changes you made offline', 'The app itself', 'Nothing is saved', 'sign-in is separate', 'your choice'])
      expect(details.text()).toContain(part)
  })

  it('has its own minimal header: brand and language toggle, no tabs, pill or footer', async () => {
    const wrapper = await mountAt('/')
    const header = wrapper.get('[data-testid="consent-header"]')
    expect(header.find('[data-testid="language-toggle"]').exists()).toBe(true)
    expect(wrapper.findAll('header')).toHaveLength(1)
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-pill"]').exists()).toBe(false)
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(false)
  })

  it('switches language before any choice, storing nothing', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="language-fr"]').trigger('click')
    expect(wrapper.text()).toContain('Pas de pub. Pas de pistage.')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('stores nothing but the choice, opens no store and sends no request before one is made', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await mountAt('/wines/7')
    expect(localStorage.length).toBe(0)
    expect(openSpy).not.toHaveBeenCalled()
    // Only the connectivity check runs in every mode; no data request.
    expect(fetchSpy.mock.calls.map(([url]) => url).filter((url) => url !== '/health')).toEqual([])
    expect(registerPwaUpdates).not.toHaveBeenCalled()
    expect(syncNow).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('refusing records the refusal and reloads into the intended destination, online-only', async () => {
    const wrapper = await mountAt('/wines/7')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(readConsent()).toBe('refused')
    expect(reloadInto).toHaveBeenCalledWith('/wines/7')
    expect(registerPwaUpdates).not.toHaveBeenCalled()
    expect(syncNow).not.toHaveBeenCalled()
    expect(Object.keys(localStorage)).toEqual([CONSENT_STORAGE_KEY])
  })

  it('granting records consent, registers the service worker, pulls with progress, then reloads', async () => {
    let finish!: () => void
    vi.mocked(syncNow).mockImplementation(async (onProgress) => {
      onProgress?.(2, 6)
      await new Promise<void>((resolve) => (finish = resolve))
    })
    const wrapper = await mountAt('/manage')
    await wrapper.get('[data-testid="language-fr"]').trigger('click')
    await wrapper.get('[data-testid="consent-allow"]').trigger('click')
    await flushPromises()
    expect(readConsent()).toBe('granted')
    expect(registerPwaUpdates).toHaveBeenCalledOnce()
    const progress = wrapper.get('[data-testid="consent-progress"]')
    expect(progress.text()).toContain('Étape 2 sur 6')
    expect(progress.get('progress').attributes()).toMatchObject({ value: '2', max: '6' })
    expect(reloadInto).not.toHaveBeenCalled()
    finish()
    await flushPromises()
    expect(reloadInto).toHaveBeenCalledWith('/manage')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr')
  })

  it('shows an error when the first pull fails and retries without asking again', async () => {
    vi.mocked(syncNow).mockRejectedValueOnce(new Error('offline'))
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-allow"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="consent-error"]').text()).toContain('could not be downloaded')
    expect(reloadInto).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="consent-retry"]').trigger('click')
    await flushPromises()
    expect(syncNow).toHaveBeenCalledTimes(2)
    expect(registerPwaUpdates).toHaveBeenCalledOnce()
    expect(reloadInto).toHaveBeenCalledWith('/')
  })

  it('lets the user continue without after a failed first pull', async () => {
    vi.mocked(syncNow).mockRejectedValueOnce(new Error('offline'))
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-allow"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(readConsent()).toBe('refused')
    expect(reloadInto).toHaveBeenCalledWith('/')
  })

  it('does not keep the language on the device after a refusal', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="language-fr"]').trigger('click')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('drops a language kept from an earlier grant when refusing', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('refusing on a first visit has no store to delete or sync', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(syncNow).not.toHaveBeenCalled()
    expect(openSpy).not.toHaveBeenCalled()
  })
})

const queued = { entity: 'wine', action: 'create', targetId: -1, payload: {} } as const

// A tester from before consent existed: a populated store and no record.
async function existingInstall() {
  await db.open()
  await db.wines.put({ id: 1 } as never)
  await enqueue(db.outbox, queued)
  openSpy.mockClear()
}

describe('ConsentView on an existing install', () => {
  it.each([
    ['no record', () => setConsent('no-choice')],
    ['a record for an older consent text', () => localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ choice: 'granted', version: 0, timestamp: '2025-01-01T00:00:00.000Z' }))],
  ])('with %s, shows the page and leaves the store alone until the user answers', async (_label, arrange) => {
    await existingInstall()
    arrange()
    const wrapper = await mountAt('/wines/1')
    await flushPromises()
    expect(wrapper.find('[data-testid="consent-choices"]').exists()).toBe(true)
    expect(openSpy).not.toHaveBeenCalled()
    expect(syncNow).not.toHaveBeenCalled()
    expect(deleteLocalData).not.toHaveBeenCalled()
  })

  it('granting keeps every record and queued item', async () => {
    await existingInstall()
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-allow"]').trigger('click')
    await flushPromises()
    expect(reloadInto).toHaveBeenCalledWith('/')
    expect(deleteLocalData).not.toHaveBeenCalled()
    expect(await db.wines.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
  })

  it('refusing with nothing unsent syncs, deletes the local data and reloads without asking', async () => {
    await db.open()
    await db.wines.put({ id: 1 } as never)
    const wrapper = await mountAt('/manage')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(syncNow).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="confirm-dialog"][open]').exists()).toBe(false)
    expect(deleteLocalData).toHaveBeenCalledOnce()
    expect(readConsent()).toBe('refused')
    expect(reloadInto).toHaveBeenCalledWith('/manage')
  })

  it('refusing with unsent changes asks first, and cancelling changes nothing', async () => {
    await existingInstall()
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="confirm-dialog"]').text()).toContain('1 change has not been sent')
    expect(deleteLocalData).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()
    expect(readConsent()).toBe('no-choice')
    expect(deleteLocalData).not.toHaveBeenCalled()
    expect(reloadInto).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
    expect(wrapper.find('[data-testid="consent-choices"]').exists()).toBe(true)
  })

  it('refusing with unsent changes deletes everything once the user confirms', async () => {
    await existingInstall()
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(deleteLocalData).toHaveBeenCalledOnce()
    expect(readConsent()).toBe('refused')
    expect(reloadInto).toHaveBeenCalledWith('/')
  })
})
