import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { db } from '../db/localDb'
import { enqueue } from '../sync/outbox'
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
      { path: '/sync-status', name: 'sync-status', component: stub },
    ],
  })
}

async function flushPromises() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
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

  it('hides the sync-status indicator when the outbox is empty', async () => {
    const { wrapper } = await mountAt('/')

    expect(wrapper.find('[data-testid="sync-status-indicator"]').exists()).toBe(false)
  })

  it('shows the sync-status indicator whenever an item is pending, even offline', async () => {
    await enqueue(db.outbox, { entity: 'wine', action: 'create', targetId: -1, payload: {} })

    const { wrapper } = await mountAt('/')
    await flushPromises()

    const indicator = wrapper.get('[data-testid="sync-status-indicator"]')
    expect(indicator.attributes('href')).toBe('/sync-status')
  })

  it('shows the sync-status indicator for a failed item too', async () => {
    const id = await enqueue(db.outbox, { entity: 'producer', action: 'create', targetId: -1, payload: {} })
    await db.outbox.update(id, { status: 'failed', error: 'already_exists' })

    const { wrapper } = await mountAt('/')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-status-indicator"]').exists()).toBe(true)
  })
})
