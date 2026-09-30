import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../db/localDb'
import { pushChangesInBackground } from '../sync'
import { enqueue } from '../sync/outbox'
import SyncStatusView from './SyncStatusView.vue'

vi.mock('../sync', async () => {
  const actual = await vi.importActual<typeof import('../sync')>('../sync')
  return { ...actual, pushChangesInBackground: vi.fn() }
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
})
