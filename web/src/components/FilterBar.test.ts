import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { emptySearchFilters, type SearchFilters } from '../domain/searchFilters'
import FilterBar from './FilterBar.vue'

const appellations = [{ id: 1, name: 'Chinon' }]
const meals = [{ id: 1, name: 'Boeuf bourguignon' }]

function mountFilterBar(filters: SearchFilters) {
  return mount(FilterBar, { props: { filters, appellations, meals } })
}

describe('FilterBar', () => {
  it('hides the clear-filters button when no filter is active', () => {
    const wrapper = mountFilterBar(emptySearchFilters)

    expect(wrapper.find('[data-testid="clear-filters-button"]').exists()).toBe(false)
  })

  it('shows the clear-filters button when a filter is active', () => {
    const wrapper = mountFilterBar({ ...emptySearchFilters, color: 'rouge' })

    expect(wrapper.find('[data-testid="clear-filters-button"]').exists()).toBe(true)
  })

  it('emits empty filters when the clear-filters button is clicked', async () => {
    const wrapper = mountFilterBar({ ...emptySearchFilters, mealId: 1, readyNow: true })

    await wrapper.find('[data-testid="clear-filters-button"]').trigger('click')

    expect(wrapper.emitted('update:filters')![0]).toEqual([emptySearchFilters])
  })
})
