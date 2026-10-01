import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { db } from '../db/localDb'
import { enqueueAppellationCreate } from '../sync/appellationSync'
import { discard } from '../sync/outbox'
import CreateFeedback from './CreateFeedback.vue'

const base = { creating: false, created: null, error: null, testid: 'new-thing', entity: 'appellation' }

// Dexie reads under fake-indexeddb each take a macrotask.
async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

describe('CreateFeedback', () => {
  it('renders nothing visible when idle', () => {
    const wrapper = mount(CreateFeedback, { props: base })
    expect(wrapper.text()).toBe('')
  })

  it('shows progress while creating', () => {
    const wrapper = mount(CreateFeedback, { props: { ...base, creating: true } })
    expect(wrapper.get('[data-testid="new-thing-creating"]').text()).toBe('Creating…')
  })

  it('confirms creation by name, with no sync note once nothing is queued', async () => {
    const wrapper = mount(CreateFeedback, { props: { ...base, created: { id: 3, name: 'Vouvray' } } })
    await settle()

    expect(wrapper.get('[data-testid="new-thing-created"]').text()).toContain('Created "Vouvray"')
    expect(wrapper.find('[data-testid="new-thing-pending"]').exists()).toBe(false)
  })

  it('notes the pending sync while the create is queued, and drops it once it leaves the outbox', async () => {
    const outboxId = await enqueueAppellationCreate(-9, { name: 'Vouvray', client_id: 'c1' })
    const wrapper = mount(CreateFeedback, { props: { ...base, created: { id: -9, name: 'Vouvray' } } })
    await settle()
    expect(wrapper.get('[data-testid="new-thing-pending"]').text()).toContain('not synced yet')

    await discard(db.outbox, outboxId)
    await settle()
    expect(wrapper.find('[data-testid="new-thing-pending"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="new-thing-created"]').exists()).toBe(true)
  })

  it('shows the error as an alert, taking priority over the rest, with a custom testid', () => {
    const wrapper = mount(CreateFeedback, {
      props: { ...base, created: { id: 3, name: 'Vouvray' }, error: 'Boom', errorTestid: 'custom-error' },
    })
    const alert = wrapper.get('[data-testid="custom-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe('Boom')
    expect(wrapper.find('[data-testid="new-thing-created"]').exists()).toBe(false)
  })
})
