import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { setTestLocale } from '../test/i18n'
import AppFooter from './AppFooter.vue'

async function mountFooter(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: { template: '<div />' } },
      { path: '/storage', name: 'storage', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(AppFooter, { global: { plugins: [router] } })
}

describe('AppFooter', () => {
  it('holds one Cookie preferences link to the consent settings page, in French too', async () => {
    const wrapper = await mountFooter()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].text()).toBe('Cookie preferences')
    expect(links[0].attributes('href')).toBe('/storage')

    setTestLocale('fr')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('a').text()).toBe('Préférences cookies')
  })

  it('has no link on the consent settings page itself', async () => {
    const wrapper = await mountFooter('/storage')
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
