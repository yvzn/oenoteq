import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ManageHubView from './ManageHubView.vue'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/manage', name: 'manage', component: ManageHubView },
      { path: '/meals', name: 'meals', component: { template: '<div />' } },
      { path: '/appellations', name: 'appellations', component: { template: '<div />' } },
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
  it('renders links to Meals, Appellations, and Meal pairings', async () => {
    const { wrapper } = await mountAt('/manage')

    expect(wrapper.text()).toContain('Manage')

    const mealsLink = wrapper.get('[data-testid="manage-link-meals"]')
    expect(mealsLink.text()).toContain('Meals')
    expect(mealsLink.attributes('href')).toBe('/meals')

    const appellationsLink = wrapper.get('[data-testid="manage-link-appellations"]')
    expect(appellationsLink.text()).toContain('Appellations')
    expect(appellationsLink.attributes('href')).toBe('/appellations')

    const mealPairingsLink = wrapper.get('[data-testid="manage-link-meal-pairings"]')
    expect(mealPairingsLink.text()).toContain('Meal pairings')
    expect(mealPairingsLink.attributes('href')).toBe('/meal-pairings')
  })
})
