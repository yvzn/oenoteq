import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { emptySearchFilters, type SearchFilters } from '../domain/searchFilters'
import FilterBar from './FilterBar.vue'

const appellations = [{ id: 1, name: 'Chinon' }]
const meals = [{ id: 1, name: 'Boeuf bourguignon' }]

function mountFilterBar(filters: SearchFilters) {
  return mount(FilterBar, { props: { filters, appellations, meals } })
}

async function openPanel(wrapper: ReturnType<typeof mountFilterBar>) {
  await wrapper.get('[data-testid="filter-toggle-button"]').trigger('click')
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

  describe('mobile filter panel', () => {
    it('shows the active filter count on the toggle button', () => {
      const wrapper = mountFilterBar({ ...emptySearchFilters, mealId: 1, readyNow: true })

      expect(wrapper.get('[data-testid="filter-toggle-button"]').text()).toContain('2')
    })

    it('shows no count on the toggle button when no filter is active', () => {
      const wrapper = mountFilterBar(emptySearchFilters)

      expect(wrapper.get('[data-testid="filter-toggle-button"]').text()).not.toMatch(/\d/)
    })

    it('hides the standalone mobile clear-filters button when no filter is active', () => {
      const wrapper = mountFilterBar(emptySearchFilters)

      expect(wrapper.find('[data-testid="mobile-clear-filters-button"]').exists()).toBe(false)
    })

    it('is closed until the toggle button is clicked', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      expect(dialog.open).toBe(false)

      await openPanel(wrapper)

      expect(dialog.open).toBe(true)
    })

    it('seeds the panel draft from the current filters when opened', async () => {
      const wrapper = mountFilterBar({ ...emptySearchFilters, color: 'rouge' })

      await openPanel(wrapper)

      expect(
        wrapper.get<HTMLSelectElement>('[data-testid="color-filter-mobile"]').element.value,
      ).toBe('rouge')
    })

    it('does not emit while editing the draft, only on apply', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)

      await openPanel(wrapper)
      await wrapper
        .get('[data-testid="color-filter-mobile"]')
        .setValue('rouge')

      expect(wrapper.emitted('update:filters')).toBeUndefined()

      await wrapper.get('[data-testid="filter-panel-apply"]').trigger('click')

      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...emptySearchFilters, color: 'rouge' },
      ])
    })

    it('closes the panel on apply', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      await openPanel(wrapper)
      await wrapper.get('[data-testid="filter-panel-apply"]').trigger('click')

      expect(dialog.open).toBe(false)
    })

    it('discards the draft and emits nothing when closed via the close button', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      await openPanel(wrapper)
      await wrapper.get('[data-testid="color-filter-mobile"]').setValue('rouge')
      await wrapper.get('[data-testid="filter-panel-close"]').trigger('click')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:filters')).toBeUndefined()
    })

    it('discards the draft and emits nothing on native cancel (e.g. Escape)', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      await openPanel(wrapper)
      await wrapper.get('[data-testid="color-filter-mobile"]').setValue('rouge')
      await wrapper.get('[data-testid="filter-panel"]').trigger('cancel')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:filters')).toBeUndefined()
    })

    it('discards the draft and emits nothing when clicking the backdrop', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      await openPanel(wrapper)
      await wrapper.get('[data-testid="filter-panel"]').trigger('click')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:filters')).toBeUndefined()
    })

    it('clears, applies, and closes immediately when clearing inside the panel', async () => {
      const wrapper = mountFilterBar({ ...emptySearchFilters, mealId: 1, readyNow: true })
      const dialog = wrapper.get('[data-testid="filter-panel"]').element as HTMLDialogElement

      await openPanel(wrapper)
      await wrapper.get('[data-testid="filter-panel-clear"]').trigger('click')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:filters')![0]).toEqual([emptySearchFilters])
    })
  })
})
