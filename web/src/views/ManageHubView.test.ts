import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { setTestLocale } from '../test/i18n'
import ManageHubView from './ManageHubView.vue'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/manage', name: 'manage', component: ManageHubView },
      { path: '/meals', name: 'meals', component: { template: '<div />' } },
      { path: '/appellations', name: 'appellations', component: { template: '<div />' } },
      { path: '/producers', name: 'producers', component: { template: '<div />' } },
      { path: '/meal-pairings', name: 'meal-pairings', component: { template: '<div />' } },
      { path: '/storage', name: 'storage', component: { template: '<div />' } },
    ],
  })
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(ManageHubView, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('ManageHubView', () => {
  it('renders links to Meals, Appellations, Producers, and Meal pairings', async () => {
    const { wrapper } = await mountAt('/manage')

    expect(wrapper.text()).toContain('Manage')

    const mealsLink = wrapper.get('[data-testid="manage-link-meals"]')
    expect(mealsLink.text()).toContain('Meals')
    expect(mealsLink.attributes('href')).toBe('/meals')

    const appellationsLink = wrapper.get('[data-testid="manage-link-appellations"]')
    expect(appellationsLink.text()).toContain('Appellations')
    expect(appellationsLink.attributes('href')).toBe('/appellations')

    const producersLink = wrapper.get('[data-testid="manage-link-producers"]')
    expect(producersLink.text()).toContain('Producers')
    expect(producersLink.attributes('href')).toBe('/producers')

    const mealPairingsLink = wrapper.get('[data-testid="manage-link-meal-pairings"]')
    expect(mealPairingsLink.text()).toContain('Meal pairings')
    expect(mealPairingsLink.attributes('href')).toBe('/meal-pairings')
  })

  it('links to the storage choice, in French too', async () => {
    const { wrapper } = await mountAt('/manage')
    const link = wrapper.get('[data-testid="manage-link-storage"]')
    expect(link.text()).toContain('Storage on this device')
    expect(link.attributes('href')).toBe('/storage')

    setTestLocale('fr')
    await nextTick()
    expect(wrapper.get('[data-testid="manage-link-storage"]').text()).toContain('Stockage sur cet appareil')
  })

  it('has no language switcher', async () => {
    const { wrapper } = await mountAt('/manage')

    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="language-fr"]').exists()).toBe(false)
  })

  it('renders in French when the locale is French', async () => {
    setTestLocale('fr')
    const { wrapper } = await mountAt('/manage')

    expect(wrapper.text()).toContain('Producteurs')
  })
})
