import { mount } from '@vue/test-utils'
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

  it('lists each language by its own name', async () => {
    const { wrapper } = await mountAt('/manage')
    expect(wrapper.get('[data-testid="language-en"]').text()).toBe('English')
    expect(wrapper.get('[data-testid="language-fr"]').text()).toBe('Français')
  })

  it('switches the whole hub to French in place, then back, without touching links', async () => {
    const { wrapper } = await mountAt('/manage')

    await wrapper.get('[data-testid="language-fr"]').trigger('click')

    expect(wrapper.text()).toContain('Gérer')
    const pairings = wrapper.get('[data-testid="manage-link-meal-pairings"]')
    expect(pairings.text()).toContain('Accords mets-vin')
    expect(pairings.attributes('href')).toBe('/meal-pairings')
    expect(wrapper.get('[data-testid="language-fr"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="language-en"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-testid="language-en"]').trigger('click')
    expect(wrapper.text()).toContain('Manage')
  })

  it('renders in French when the locale is French', async () => {
    setTestLocale('fr')
    const { wrapper } = await mountAt('/manage')

    expect(wrapper.text()).toContain('Producteurs')
  })
})
