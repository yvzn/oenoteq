import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { useHighlight } from '../composables/useHighlight'
import LiveAnnouncer from './LiveAnnouncer.vue'

afterEach(() => {
  useHighlight().clear()
})

describe('LiveAnnouncer', () => {
  it('is a polite, visually hidden live region carrying the confirmation text', async () => {
    const wrapper = mount(LiveAnnouncer)

    useHighlight().highlight('quantity', 'Quantity adjusted.')
    await wrapper.vm.$nextTick()

    const region = wrapper.get('[data-testid="live-announcer"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.classes()).toContain('sr-only')
    expect(region.text()).toBe('Quantity adjusted.')
  })
})
