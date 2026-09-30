import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { db } from '../db/localDb'
import { discard, enqueue } from '../sync/outbox'
import SyncPendingBadge from './SyncPendingBadge.vue'

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('SyncPendingBadge', () => {
  it('is hidden when there is no queued outbox item for this entity+id', async () => {
    const wrapper = mount(SyncPendingBadge, { props: { entity: 'producer', targetId: 1 } })
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-pending-badge"]').exists()).toBe(false)
  })

  it('shows once a create for this record is queued', async () => {
    await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: { name: 'x' } })

    const wrapper = mount(SyncPendingBadge, { props: { entity: 'producer', targetId: -1 } })
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-pending-badge"]').text()).toBe('Not yet synced')
  })

  it('ignores a queued item for a different entity or a different id', async () => {
    await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: { name: 'x' } })

    const wrongEntity = mount(SyncPendingBadge, { props: { entity: 'appellation', targetId: -1 } })
    const wrongId = mount(SyncPendingBadge, { props: { entity: 'producer', targetId: -2 } })
    await flushPromises()

    expect(wrongEntity.find('[data-testid="sync-pending-badge"]').exists()).toBe(false)
    expect(wrongId.find('[data-testid="sync-pending-badge"]').exists()).toBe(false)
  })

  it('disappears once the queued item is discarded', async () => {
    const id = await enqueue(db.outbox, { entity: 'meal', action: 'update', targetId: 7, payload: {} })
    const wrapper = mount(SyncPendingBadge, { props: { entity: 'meal', targetId: 7 } })
    await flushPromises()
    expect(wrapper.find('[data-testid="sync-pending-badge"]').exists()).toBe(true)

    await discard(db.outbox, id)
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-pending-badge"]').exists()).toBe(false)
  })
})
