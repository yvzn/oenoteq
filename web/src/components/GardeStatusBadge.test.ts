import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { setTestLocale } from '../test/i18n'
import GardeStatusBadge from './GardeStatusBadge.vue'

describe('GardeStatusBadge', () => {
  it.each([
    ['too_young', 'Too young'],
    ['ready', 'Ready'],
    ['past_peak', 'Past peak'],
    ['unassessed', 'Not assessed'],
  ] as const)('shows %s in English', (status, text) => {
    expect(mount(GardeStatusBadge, { props: { status } }).text()).toBe(text)
  })

  it.each([
    ['too_young', 'Trop jeune'],
    ['ready', 'À boire'],
    ['past_peak', 'Passé'],
    ['unassessed', 'Non évalué'],
  ] as const)('shows %s in French', (status, text) => {
    setTestLocale('fr')

    expect(mount(GardeStatusBadge, { props: { status } }).text()).toBe(text)
  })

  it('follows a language switch in place', async () => {
    const wrapper = mount(GardeStatusBadge, { props: { status: 'ready' } })
    setTestLocale('fr')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('À boire')
  })
})
