import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { db } from '../db/localDb'
import { pushChangesInBackground, syncNow } from '../sync'
import { discard, enqueue } from '../sync/outbox'
import { setTestLocale } from '../test/i18n'
import SyncStatusView from './SyncStatusView.vue'

vi.mock('../sync', async () => {
  const actual = await vi.importActual<typeof import('../sync')>('../sync')
  return { ...actual, pushChangesInBackground: vi.fn(), syncNow: vi.fn() }
})

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const setNavigatorOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })

afterEach(() => {
  vi.mocked(syncNow).mockReset()
  vi.mocked(apiClient.get).mockReset()
  setNavigatorOnLine(true)
})

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

async function mountView() {
  const wrapper = mount(SyncStatusView)
  await flushPromises()
  return wrapper
}

describe('SyncStatusView', () => {
  it('shows a zero pending-count for every entity type when the outbox is empty', async () => {
    const wrapper = await mountView()

    const rows = wrapper.findAll('[data-testid="sync-status-count"]')
    expect(rows.map((row) => row.text())).toEqual([
      'Wine0',
      'Consumption0',
      'Producer0',
      'Appellation0',
      'Meal0',
      'Meal Pairing0',
    ])
    expect(wrapper.find('[data-testid="sync-status-no-failures"]').exists()).toBe(true)
  })

  it('shows one pending-count per entity type, folding quantity_adjustment into Wine', async () => {
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })
    await enqueue(db.outbox, { entity: 'quantity_adjustment', action: 'create', targetId: 3, payload: {} })
    await enqueue(db.outbox, { entity: 'consumption', action: 'create', targetId: -2, payload: {} })

    const wrapper = await mountView()

    const rows = wrapper.findAll('[data-testid="sync-status-count"]')
    expect(rows[0]!.text()).toBe('Wine2')
    expect(rows[1]!.text()).toBe('Consumption1')
  })

  it('lists a failed item with its plain-language reason', async () => {
    const id = await enqueue(db.outbox, { entity: 'producer', action: 'update', targetId: 4, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'producer_not_found' })

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="sync-status-no-failures"]').exists()).toBe(false)
    const item = wrapper.get('[data-testid="sync-status-failed-item"]')
    expect(item.text()).toContain('Producer')
    expect(wrapper.get('[data-testid="sync-status-failed-reason"]').text()).toBe(
      "That producer doesn't exist anymore. Recreate it, then retry.",
    )
  })

  it('retries a failed item without disturbing other queued items', async () => {
    const failingId = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
    await db.outbox.update(failingId, { status: 'failed', error: 'meal_not_found' })
    await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: {} })

    const wrapper = await mountView()
    await wrapper.get('[data-testid="sync-status-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-status-failed-item"]').exists()).toBe(false)
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(2)
    expect(outboxItems.find((item) => item.id === failingId)).toMatchObject({ status: 'pending', error: null })
    expect(pushChangesInBackground).toHaveBeenCalled()
  })

  it('discards a failed item, independently of other queued items, after confirming', async () => {
    const failingId = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
    await db.outbox.update(failingId, { status: 'failed', error: 'meal_not_found' })
    await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: {} })

    const wrapper = await mountView()
    await wrapper.get('[data-testid="sync-status-discard"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').isVisible()).toBe(true)
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-status-failed-item"]').exists()).toBe(false)
    const outboxItems = await db.outbox.toArray()
    expect(outboxItems).toHaveLength(1)
    expect(outboxItems[0]).toMatchObject({ entity: 'appellation' })
  })

  it('leaves the failed item untouched if discard is canceled', async () => {
    const failingId = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
    await db.outbox.update(failingId, { status: 'failed', error: 'meal_not_found' })

    const wrapper = await mountView()
    await wrapper.get('[data-testid="sync-status-discard"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-status-failed-item"]').exists()).toBe(true)
    expect(await db.outbox.count()).toBe(1)
  })

  describe('Clear queue', () => {
    it('is disabled when nothing is queued', async () => {
      const wrapper = await mountView()
      expect(wrapper.get('[data-testid="sync-status-clear"]').attributes('disabled')).toBeDefined()
    })

    it('states the item count in the confirm dialog and changes nothing on cancel', async () => {
      await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })
      const failing = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
      await db.outbox.update(failing, { status: 'failed', error: 'meal_not_found' })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="confirm-dialog"]').text()).toContain(
        "2 queued changes will be lost. This can't be undone.",
      )
      await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
      await flushPromises()

      expect(await db.outbox.count()).toBe(2)
      expect(syncNow).not.toHaveBeenCalled()
    })

    it('empties the outbox, zeroes the counts and pulls on confirm', async () => {
      vi.mocked(syncNow).mockResolvedValue()
      await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: {} })
      const failing = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
      await db.outbox.update(failing, { status: 'failed', error: 'meal_not_found' })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')
      await flushPromises()
      await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
      await flushPromises()

      expect(await db.outbox.count()).toBe(0)
      const texts = wrapper.findAll('[data-testid="sync-status-count"]').map((r) => r.text())
      expect(texts.every((t) => t.endsWith('0'))).toBe(true)
      expect(wrapper.find('[data-testid="sync-status-failed-item"]').exists()).toBe(false)
      expect(syncNow).toHaveBeenCalledTimes(1)
    })

    it('still clears the queue when the follow-up pull fails', async () => {
      vi.mocked(syncNow).mockRejectedValue(new Error('boom'))
      await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: {} })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')
      await flushPromises()
      await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
      await flushPromises()

      expect(await db.outbox.count()).toBe(0)
    })

    it('defers the follow-up pull while offline but still drops local-only records', async () => {
      setNavigatorOnLine(false)
      await db.producers.put({ id: -1, name: 'Local only' })
      await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: {} })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')
      await flushPromises()
      await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
      await flushPromises()

      expect(await db.outbox.count()).toBe(0)
      expect(await db.producers.get(-1)).toBeUndefined()
      expect(syncNow).not.toHaveBeenCalled()
    })
  })

  describe('Retry sync', () => {
    it('runs a full sync on click, disabled while in flight, then refreshes counts', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({})
      let finish!: () => void
      vi.mocked(syncNow).mockImplementation(
        () => new Promise<void>((resolve) => (finish = resolve)),
      )
      await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: {} })

      const wrapper = await mountView()
      const button = wrapper.get('[data-testid="sync-status-retry-all"]')
      expect(button.attributes('disabled')).toBeUndefined()
      expect(wrapper.get('[data-testid="sync-status-count"]:nth-child(4)').text()).toBe('Appellation1')

      await button.trigger('click')
      await button.trigger('click')
      await flushPromises()

      expect(syncNow).toHaveBeenCalledTimes(1)
      expect(button.attributes('disabled')).toBeDefined()
      expect(button.text()).toBe('Syncing…')

      await db.outbox.clear()
      finish()
      await flushPromises()

      expect(button.attributes('disabled')).toBeUndefined()
      expect(button.text()).toBe('Retry sync')
      expect(wrapper.get('[data-testid="sync-status-count"]:nth-child(4)').text()).toBe('Appellation0')
    })

    it('is disabled with an explanation while offline and does not sync', async () => {
      setNavigatorOnLine(false)

      const wrapper = await mountView()
      const button = wrapper.get('[data-testid="sync-status-retry-all"]')

      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.get('[data-testid="sync-status-offline-note"]').text()).toBe(
        "You're offline. Sync will run when you're back online.",
      )
      await button.trigger('click')
      expect(syncNow).not.toHaveBeenCalled()
    })

    it('does not retry failed items implicitly, same as the reconnect path', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({})
      vi.mocked(syncNow).mockResolvedValue()
      const failingId = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
      await db.outbox.update(failingId, { status: 'failed', error: 'meal_not_found' })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-retry-all"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="sync-status-failed-item"]').exists()).toBe(true)
      expect(await db.outbox.get(failingId)).toMatchObject({ status: 'failed' })
    })

    it('re-enables and refreshes even if the sync fails', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({})
      vi.mocked(syncNow).mockRejectedValue(new Error('boom'))

      const wrapper = await mountView()
      const button = wrapper.get('[data-testid="sync-status-retry-all"]')
      await button.trigger('click')
      await flushPromises()

      expect(button.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Show details', () => {
    it('renders counts only by default, with no pending list in the DOM', async () => {
      await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -1, payload: { name: 'Roast' } })

      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="sync-status-pending-list"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="sync-status-nothing-pending"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="sync-status-toggle-details"]').text()).toBe('Show details')
    })

    it('reveals one row per pending item in queue order, and hides again on second click', async () => {
      await db.producers.put({ id: 1, name: 'Château X' })
      await db.appellations.put({ id: 2, name: 'Pomerol' })
      await enqueue(db.outbox, {
        entity: 'wine',
        action: 'create',
        targetId: -1,
        payload: { producer_id: 1, appellation_id: 2, millesime: 2015 },
      })
      await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -2, payload: { name: 'Roast' } })

      const wrapper = await mountView()
      const toggle = wrapper.get('[data-testid="sync-status-toggle-details"]')
      await toggle.trigger('click')

      const rows = wrapper.findAll('[data-testid="sync-status-pending-item"]')
      expect(rows).toHaveLength(2)
      expect(rows[0]!.text()).toContain('Château X · Pomerol · 2015')
      expect(rows[0]!.get('[data-testid="sync-status-pending-operation"]').text()).toBe('Create')
      expect(rows[0]!.find('[data-testid="sync-status-pending-time"]').exists()).toBe(true)
      expect(rows[1]!.text()).toContain('Roast')
      expect(toggle.text()).toBe('Hide details')

      await toggle.trigger('click')
      expect(wrapper.find('[data-testid="sync-status-pending-list"]').exists()).toBe(false)
    })

    it('renders items queued without a timestamp, minus the time', async () => {
      const id = await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -1, payload: { name: 'Roast' } })
      await db.outbox.update(id, { createdAt: undefined })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-toggle-details"]').trigger('click')

      expect(wrapper.get('[data-testid="sync-status-pending-item"]').text()).toContain('Roast')
      expect(wrapper.find('[data-testid="sync-status-pending-time"]').exists()).toBe(false)
    })

    it('does not duplicate failed items in the pending list', async () => {
      const failing = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 1, payload: {} })
      await db.outbox.update(failing, { status: 'failed', error: 'meal_not_found' })
      await enqueue(db.outbox, { entity: 'appellation', action: 'create', targetId: -1, payload: { name: 'Pomerol' } })

      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-toggle-details"]').trigger('click')

      expect(wrapper.findAll('[data-testid="sync-status-pending-item"]')).toHaveLength(1)
      expect(wrapper.findAll('[data-testid="sync-status-failed-item"]')).toHaveLength(1)
    })

    it('says "Nothing pending." when expanded with an empty outbox', async () => {
      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-toggle-details"]').trigger('click')

      expect(wrapper.get('[data-testid="sync-status-nothing-pending"]').text()).toBe('Nothing pending.')
    })

    it('updates live as items leave the outbox', async () => {
      const id = await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -1, payload: { name: 'Roast' } })
      const wrapper = await mountView()
      await wrapper.get('[data-testid="sync-status-toggle-details"]').trigger('click')
      expect(wrapper.findAll('[data-testid="sync-status-pending-item"]')).toHaveLength(1)

      await discard(db.outbox, id)
      await flushPromises()

      expect(wrapper.find('[data-testid="sync-status-pending-item"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="sync-status-nothing-pending"]').exists()).toBe(true)
    })
  })
})

describe('SyncStatusView in French', () => {
  it('translates the page, the entity names and the actions', async () => {
    setTestLocale('fr')

    const wrapper = await mountView()

    expect(wrapper.get('h2').text()).toBe('État de la synchronisation')
    expect(wrapper.findAll('[data-testid="sync-status-count"]').map((row) => row.text())).toEqual([
      'Vin0',
      'Consommation0',
      'Producteur0',
      'Appellation0',
      'Plat0',
      'Accord mets-vin0',
    ])
    expect(wrapper.get('[data-testid="sync-status-retry-all"]').text()).toBe('Relancer la synchro')
  })

  it('renders a failure queued before a language switch in the new language', async () => {
    const id = await enqueue(db.outbox, { entity: 'producer', action: 'update', targetId: 4, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'producer_not_found' })
    const wrapper = await mountView()
    expect(wrapper.get('[data-testid="sync-status-failed-reason"]').text()).toBe(
      "That producer doesn't exist anymore. Recreate it, then retry.",
    )

    setTestLocale('fr')
    await flushPromises()

    expect(wrapper.get('[data-testid="sync-status-failed-reason"]').text()).toBe(
      "Ce producteur n'existe plus. Recréez l'élément, puis réessayez.",
    )
    expect(wrapper.get('[data-testid="sync-status-failed-item"]').text()).toContain('Producteur')
    expect((await db.outbox.get(id))!.error).toBe('producer_not_found')
  })

  it('shows an unknown failure code as the generic message in the active language', async () => {
    const id = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 4, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'brand_new_code' })
    setTestLocale('fr')

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="sync-status-failed-reason"]').text()).toBe(
      'Une erreur est survenue. Veuillez réessayer.',
    )
  })

  it.each([
    [1, "Vider la file d'attente ? 1 modification en attente sera perdue."],
    [2, "Vider la file d'attente ? 2 modifications en attente seront perdues."],
  ])('uses the right plural when clearing %i queued changes', async (count, expected) => {
    setTestLocale('fr')
    for (let i = 0; i < count; i++) {
      await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -(i + 1), payload: {} })
    }
    const wrapper = await mountView()

    await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')

    expect(wrapper.get('[data-testid="confirm-dialog"]').text()).toContain(expected)
  })

  it('says "1 change" and "2 changes" in English', async () => {
    await enqueue(db.outbox, { entity: 'meal', action: 'create', targetId: -1, payload: {} })
    const wrapper = await mountView()
    await wrapper.get('[data-testid="sync-status-clear"]').trigger('click')
    expect(wrapper.get('[data-testid="confirm-dialog"]').text()).toContain('1 queued change will be lost')
  })
})
