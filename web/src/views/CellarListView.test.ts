import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { apiClient } from '../api/client'
import CellarListView from './CellarListView.vue'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } }
})

const currentYear = new Date().getFullYear()

const wines = [
  {
    id: 1,
    millesime: 2018,
    appellation_id: 1,
    producer: 'Les Garillères',
    color: 'rouge',
    garde_debut: currentYear - 5,
    garde_fin: currentYear + 5,
    quantity: 3,
  },
  {
    id: 2,
    millesime: null,
    appellation_id: 2,
    producer: 'Domaine X',
    color: 'blanc',
    garde_debut: currentYear + 1,
    garde_fin: currentYear + 10,
    quantity: 1,
  },
]

const appellations = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
]

afterEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('CellarListView', () => {
  it('shows a loading indicator before the fetches resolve', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(CellarListView)
    await nextTick()

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
  })

  it('renders one item per wine with resolved appellation name, fields, and garde badge', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve(wines)
      if (path === '/appellations') return Promise.resolve(appellations)
      throw new Error(`unexpected path: ${path}`)
    })

    const wrapper = mount(CellarListView)
    await flushPromises()

    const items = wrapper.findAll('[data-testid="wine-item"]')
    expect(items).toHaveLength(2)

    expect(items[0].text()).toContain('Les Garillères')
    expect(items[0].text()).toContain('Chinon')
    expect(items[0].text()).toContain('2018')
    expect(items[0].text()).toContain('rouge')
    expect(items[0].text()).toContain('3')
    expect(items[0].text()).toContain('Ready')

    expect(items[1].text()).toContain('Domaine X')
    expect(items[1].text()).toContain('Sancerre')
    expect(items[1].text()).toContain('NV')
    expect(items[1].text()).toContain('Too young')
  })

  it('shows an error state distinct from loading when a fetch fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.reject(new Error('server exploded'))
      return Promise.resolve(appellations)
    })

    const wrapper = mount(CellarListView)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(false)
  })

  it('renders an empty list with no loading or error when there are no wines', async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === '/wines') return Promise.resolve([])
      return Promise.resolve(appellations)
    })

    const wrapper = mount(CellarListView)
    await flushPromises()

    expect(wrapper.find('[data-testid="wine-list"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="wine-item"]')).toHaveLength(0)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
