import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { deleteLocalData } from '../consent/deleteLocalData'
import { reloadInto } from '../consent/reload'
import { readConsent } from '../consent/storageConsent'
import { db } from '../db/localDb'
import { LOCALE_STORAGE_KEY } from '../i18n/localePreference'
import { registerPwaUpdates } from '../registerPwa'
import { createAppRouter } from '../router'
import { syncNow } from '../sync'
import { enqueue } from '../sync/outbox'
import { setConsent } from '../test/consent'
import { setTestLocale } from '../test/i18n'
import App from '../App.vue'

vi.mock('../consent/reload', () => ({ reloadInto: vi.fn() }))
vi.mock('../consent/deleteLocalData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../consent/deleteLocalData')>()),
  deleteLocalData: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../registerPwa', () => ({ registerPwaUpdates: vi.fn() }))
vi.mock('../sync', () => ({ syncNow: vi.fn(), startSync: vi.fn() }))

const queued = { entity: 'wine', action: 'create', targetId: -1, payload: {} } as const

beforeEach(() => {
  vi.mocked(syncNow).mockReset().mockResolvedValue(undefined)
  vi.mocked(reloadInto).mockClear()
  vi.mocked(registerPwaUpdates).mockClear()
  vi.mocked(deleteLocalData).mockClear()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => vi.restoreAllMocks())

async function mountStorage() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/storage')
  await router.isReady()
  return mount(App, { global: { plugins: [router] } })
}

async function withdraw(wrapper: Awaited<ReturnType<typeof mountStorage>>) {
  await wrapper.get('[data-testid="storage-withdraw"]').trigger('click')
  await flushPromises()
}

const dialog = '[data-testid="confirm-dialog"]'

describe('ConsentChangeView', () => {
  it('shows offline mode on, the folded details and a button to turn it off', async () => {
    setConsent('granted')
    const wrapper = await mountStorage()
    const current = wrapper.get('[data-testid="storage-current"]').text()
    expect(current).toContain('Offline mode')
    expect(current).toContain('On')
    expect(current).toContain('saved on this device')
    const details = wrapper.get('[data-testid="consent-details"]')
    expect(details.attributes('open')).toBeUndefined()
    for (const part of ['Your wines', 'Changes you made offline', 'The app itself', 'sign-in is separate'])
      expect(details.text()).toContain(part)
    expect(wrapper.get('[data-testid="storage-withdraw"]').text()).toBe('Turn off offline mode')
    expect(wrapper.find('[data-testid="storage-grant"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="storage-withdraw"]').exists()).toBe(true)
  })

  it('shows offline mode off with a button to turn it on', async () => {
    setConsent('refused')
    const wrapper = await mountStorage()
    const current = wrapper.get('[data-testid="storage-current"]').text()
    expect(current).toContain('Off')
    expect(current).toContain('Nothing is saved')
    expect(wrapper.find('[data-testid="storage-withdraw"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="storage-grant"]').text()).toBe('Turn on offline mode')
  })

  it('gives turning on and turning off the same weight', async () => {
    setConsent('refused')
    const grant = (await mountStorage()).get('[data-testid="storage-grant"]').classes()
    setConsent('granted')
    const withdrawButton = (await mountStorage()).get('[data-testid="storage-withdraw"]').classes()
    expect(grant).toEqual(withdrawButton)
  })

  it('is written in French, with no footer link to itself when the language is French', async () => {
    setConsent('refused')
    setTestLocale('fr')
    const wrapper = await mountStorage()
    expect(wrapper.get('h2').text()).toBe('Préférences cookies')
    const current = wrapper.get('[data-testid="storage-current"]').text()
    expect(current).toContain('Mode hors ligne')
    expect(current).toContain('Désactivé')
    expect(current).toContain("Rien n'est conservé")
    expect(wrapper.find('[data-testid="cookie-preferences-link"]').exists()).toBe(false)
  })

  describe('granting later', () => {
    it('records the choice, registers the service worker, runs the first pull with progress, then reloads here', async () => {
      setConsent('refused')
      let finish!: () => void
      vi.mocked(syncNow).mockImplementation(async (onProgress) => {
        onProgress?.(3, 6)
        await new Promise<void>((resolve) => (finish = resolve))
      })
      const wrapper = await mountStorage()
      await wrapper.get('[data-testid="storage-grant"]').trigger('click')
      await flushPromises()
      expect(readConsent()).toBe('granted')
      expect(registerPwaUpdates).toHaveBeenCalledOnce()
      expect(wrapper.get('[data-testid="consent-progress"]').text()).toContain('Step 3 of 6')
      expect(reloadInto).not.toHaveBeenCalled()
      finish()
      await flushPromises()
      expect(reloadInto).toHaveBeenCalledWith('/storage')
    })

    it('offers a retry when the first pull fails', async () => {
      setConsent('refused')
      vi.mocked(syncNow).mockRejectedValueOnce(new Error('offline'))
      const wrapper = await mountStorage()
      await wrapper.get('[data-testid="storage-grant"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="consent-error"]').exists()).toBe(true)
      await wrapper.get('[data-testid="consent-retry"]').trigger('click')
      await flushPromises()
      expect(syncNow).toHaveBeenCalledTimes(2)
      expect(registerPwaUpdates).toHaveBeenCalledOnce()
      expect(reloadInto).toHaveBeenCalledWith('/storage')
    })
  })

  describe('withdrawing', () => {
    beforeEach(() => setConsent('granted'))

    it('with an empty outbox, syncs first then deletes everything and reloads without asking', async () => {
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(syncNow).toHaveBeenCalledOnce()
      expect(wrapper.find(dialog).exists()).toBe(false)
      expect(deleteLocalData).toHaveBeenCalledOnce()
      expect(readConsent()).toBe('refused')
      expect(reloadInto).toHaveBeenCalledWith('/storage')
    })

    it('forgets the language kept on the device', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
    })

    it('does not ask when the sync sends everything', async () => {
      await enqueue(db.outbox, queued)
      vi.mocked(syncNow).mockImplementation(async () => void (await db.outbox.clear()))
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      // The fake store answers on real timers, so wait for the flow rather than a fixed flush.
      await vi.waitFor(() => expect(deleteLocalData).toHaveBeenCalledOnce())
      expect(wrapper.find(dialog).exists()).toBe(false)
    })

    it('with pending items left, shows how many and deletes nothing until confirmed', async () => {
      await enqueue(db.outbox, queued)
      await enqueue(db.outbox, queued)
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(wrapper.get(dialog).text()).toContain('2 changes have not been sent')
      expect(deleteLocalData).not.toHaveBeenCalled()
      expect(readConsent()).toBe('granted')
      expect(reloadInto).not.toHaveBeenCalled()
    })

    it('says "1 change" for a single item, in French too', async () => {
      await enqueue(db.outbox, queued)
      setTestLocale('fr')
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(wrapper.get(dialog).text()).toContain("1 modification n'a pas encore été envoyée")
    })

    it('with failed items left, shows the count', async () => {
      const id = await enqueue(db.outbox, queued)
      await db.outbox.update(id, { status: 'failed', error: 'already_exists' })
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(wrapper.get(dialog).text()).toContain('1 change has not been sent')
    })

    it('offline, skips the sync and requires confirmation for what is queued', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await enqueue(db.outbox, queued)
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(syncNow).not.toHaveBeenCalled()
      expect(wrapper.get(dialog).text()).toContain('1 change has not been sent')
      expect(deleteLocalData).not.toHaveBeenCalled()
    })

    it('a failed sync never discards silently', async () => {
      await enqueue(db.outbox, queued)
      vi.mocked(syncNow).mockRejectedValue(new Error('boom'))
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(wrapper.find(dialog).exists()).toBe(true)
      expect(deleteLocalData).not.toHaveBeenCalled()
    })

    it('cancelling changes nothing', async () => {
      await enqueue(db.outbox, queued)
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
      await flushPromises()
      expect(wrapper.find(dialog).exists()).toBe(false)
      expect(deleteLocalData).not.toHaveBeenCalled()
      expect(readConsent()).toBe('granted')
      expect(reloadInto).not.toHaveBeenCalled()
      expect(await db.outbox.count()).toBe(1)
      expect(wrapper.find('[data-testid="storage-withdraw"]').exists()).toBe(true)
    })

    it('confirming deletes the local data, records the refusal and reloads', async () => {
      await enqueue(db.outbox, queued)
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
      await flushPromises()
      expect(deleteLocalData).toHaveBeenCalledOnce()
      expect(readConsent()).toBe('refused')
      expect(reloadInto).toHaveBeenCalledWith('/storage')
    })

    it('when deleting fails, keeps the choice, reloads nothing and offers a retry', async () => {
      vi.mocked(deleteLocalData).mockRejectedValueOnce(new Error('blocked'))
      const wrapper = await mountStorage()
      await withdraw(wrapper)
      expect(wrapper.find('[data-testid="withdraw-error"]').exists()).toBe(true)
      expect(readConsent()).toBe('granted')
      expect(reloadInto).not.toHaveBeenCalled()

      await wrapper.get('[data-testid="withdraw-retry"]').trigger('click')
      await flushPromises()
      expect(readConsent()).toBe('refused')
      expect(reloadInto).toHaveBeenCalledWith('/storage')
    })
  })

  it('is behind the consent gate: with no choice it lands on the consent page', async () => {
    setConsent('no-choice')
    const wrapper = await mountStorage()
    expect(wrapper.find('[data-testid="consent-choices"]').exists()).toBe(true)
  })
})
