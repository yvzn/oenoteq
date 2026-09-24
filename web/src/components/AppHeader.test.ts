import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AppHeader from './AppHeader.vue'

const stub = { template: '<div />' }

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cellar', component: stub },
      { path: '/wines/:id', name: 'wine-detail', component: stub },
      { path: '/manage', name: 'manage', component: stub },
      { path: '/meals', name: 'meals', component: stub },
      { path: '/appellations', name: 'appellations', component: stub },
      { path: '/meal-pairings', name: 'meal-pairings', component: stub },
    ],
  })
}

async function mountAt(initialPath: string) {
  const router = makeRouter()
  router.push(initialPath)
  await router.isReady()

  const wrapper = mount(AppHeader, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AppHeader', () => {
  it('shows exactly Cellar and Manage as top-level nav items', async () => {
    const { wrapper } = await mountAt('/')

    const nav = wrapper.get('nav')
    expect(nav.text()).not.toContain('Meal pairings')

    const links = nav.findAll('a')
    expect(links.map((link) => link.text())).toEqual(['Cellar', 'Manage'])
    expect(links[1]!.attributes('href')).toBe('/manage')
  })

  it('highlights Manage when on a management subpage', async () => {
    const { wrapper } = await mountAt('/meals')

    const manageLink = wrapper.get('nav').findAll('a')[1]!
    expect(manageLink.classes()).toContain('text-bordeaux')
  })
})
