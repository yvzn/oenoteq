import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { CONSENT_STORAGE_KEY, readConsent } from '../consent/storageConsent'
import { reloadInto } from '../consent/reload'
import { LOCALE_STORAGE_KEY } from '../i18n/localePreference'
import { registerPwaUpdates } from '../registerPwa'
import { createAppRouter } from '../router'
import { syncNow } from '../sync'
import { setConsent } from '../test/consent'
import App from '../App.vue'

vi.mock('../consent/reload', () => ({ reloadInto: vi.fn() }))
vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('../sync', () => ({ syncNow: vi.fn(), startSync: vi.fn() }))

let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setConsent('no-choice')
  openSpy = vi.spyOn(indexedDB, 'open')
  vi.mocked(syncNow).mockReset().mockResolvedValue(undefined)
  vi.mocked(reloadInto).mockClear()
  vi.mocked(registerPwaUpdates).mockClear()
})

afterEach(() => openSpy.mockRestore())

async function mountAt(path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return wrapper
}

describe('ConsentView', () => {
  it('is a full page with two equal, unselected choices, any route landing on it', async () => {
    const wrapper = await mountAt('/wines/7')
    const allow = wrapper.get('[data-testid="consent-allow"]')
    const refuse = wrapper.get('[data-testid="consent-refuse"]')
    expect(allow.classes()).toEqual(refuse.classes())
    expect(wrapper.find('[role="dialog"], dialog').exists()).toBe(false)
    expect(wrapper.findAll('input[type="radio"], input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.find('nav').exists()).toBe(false) // the rest of the app is not reachable
  })

  it('explains what is stored, why, what refusing costs, sign-in and changing later, in English', async () => {
    const text = (await mountAt('/')).text()
    for (const part of ['copy of your cellar', 'queue of changes', 'app cache', 'Why', 'offline', 'home screen', 'hosting platform', 'Manage page'])
      expect(text).toContain(part)
  })

  it('switches language before any choice, storing nothing', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="language-fr"]').trigger('click')
    expect(wrapper.text()).toContain('Conserver votre cave')
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
    expect(readConsent()).toBe('refused')
    expect(reloadInto).toHaveBeenCalledWith('/')
  })

  it('does not keep the language on the device after a refusal', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="language-fr"]').trigger('click')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('drops a language kept from an earlier grant when refusing', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    const wrapper = await mountAt('/')
    await wrapper.get('[data-testid="consent-refuse"]').trigger('click')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })
})
