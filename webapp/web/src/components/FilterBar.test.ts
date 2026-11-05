import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { emptySearchFilters, type CommonFilters, type SearchFilters } from '../domain/searchFilters'
import { defaultWineSort, sortAxes, type WineSort } from '../domain/wineSort'
import FilterBar from './FilterBar.vue'
import ReadyNowFilter from './ReadyNowFilter.vue'

const appellations = [{ id: 1, name: 'Chinon' }]
const meals = [{ id: 1, name: 'Boeuf bourguignon' }]

function mountFilterBar(filters: SearchFilters, sort: WineSort = defaultWineSort) {
  return mount(FilterBar<SearchFilters, WineSort['sortBy']>, {
    props: {
      filters,
      sort,
      appellations,
      meals,
      emptyFilters: emptySearchFilters,
      sortAxes,
      axisLabel: (sortBy: string) => sortBy,
      defaultSort: defaultWineSort,
    },
  })
}

async function openPanel(wrapper: Pick<VueWrapper, 'get'>) {
  await wrapper.get('[data-testid="filter-toggle-button"]').trigger('click')
}

async function openSortPanel(wrapper: Pick<VueWrapper, 'get'>) {
  await wrapper.get('[data-testid="sort-toggle-button"]').trigger('click')
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

  describe('extra filters slot', () => {
    function mountWithReadyNow(filters: SearchFilters) {
      return mount(FilterBar<SearchFilters, WineSort['sortBy']>, {
        props: {
          filters,
          sort: defaultWineSort,
          appellations,
          meals,
          emptyFilters: emptySearchFilters,
          sortAxes,
          axisLabel: (sortBy: string) => sortBy,
          defaultSort: defaultWineSort,
        },
        slots: {
          extra: ({ filters: edited, update, testidSuffix, inline }) =>
            h(ReadyNowFilter, {
              modelValue: edited.readyNow,
              testidSuffix,
              inline,
              'onUpdate:modelValue': (readyNow: boolean) => update({ readyNow }),
            }),
        },
      })
    }

    it('emits live from the inline slot content', async () => {
      const wrapper = mountWithReadyNow(emptySearchFilters)

      await wrapper.get('[data-testid="ready-now-filter"]').setValue(true)

      expect(wrapper.emitted('update:filters')![0]).toEqual([{ ...emptySearchFilters, readyNow: true }])
    })

    it('edits the draft from the mobile slot content, applied on demand', async () => {
      const wrapper = mountWithReadyNow({ ...emptySearchFilters, color: 'rouge' })

      await openPanel(wrapper)
      await wrapper.get('[data-testid="ready-now-filter-mobile"]').setValue(true)

      expect(wrapper.emitted('update:filters')).toBeUndefined()

      await wrapper.get('[data-testid="filter-panel-apply"]').trigger('click')

      expect(wrapper.emitted('update:filters')![0]).toEqual([
        { ...emptySearchFilters, color: 'rouge', readyNow: true },
      ])
    })
  })

  describe('sort toggle button', () => {
    it('shows no direction indicator when sort is default', () => {
      const wrapper = mountFilterBar(emptySearchFilters, defaultWineSort)

      expect(wrapper.get('[data-testid="sort-toggle-button"]').text()).not.toMatch(/[↑↓]/)
    })

    it('shows an ascending indicator when a non-default ascending sort is active', () => {
      const wrapper = mountFilterBar(emptySearchFilters, { sortBy: 'producer', sortDir: 'asc' })

      expect(wrapper.get('[data-testid="sort-toggle-button"]').text()).toContain('↑')
    })

    it('shows a descending indicator when a non-default descending sort is active', () => {
      const wrapper = mountFilterBar(emptySearchFilters, { sortBy: 'appellation', sortDir: 'desc' })

      expect(wrapper.get('[data-testid="sort-toggle-button"]').text()).toContain('↓')
    })
  })

  describe('mobile sort panel', () => {
    it('is closed until the sort toggle button is clicked', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      expect(dialog.open).toBe(false)

      await openSortPanel(wrapper)

      expect(dialog.open).toBe(true)
    })

    it('pre-selects the current sort axis when opened', async () => {
      const wrapper = mountFilterBar(emptySearchFilters, { sortBy: 'producer', sortDir: 'desc' })

      await openSortPanel(wrapper)

      expect(wrapper.get<HTMLInputElement>('[data-testid="sort-axis-producer"]').element.checked).toBe(
        true,
      )
      expect(
        wrapper.get<HTMLInputElement>('[data-testid="sort-axis-appellation"]').element.checked,
      ).toBe(false)
    })

    it('does not emit or close when only an axis is chosen', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-axis-millesime"]').setValue(true)

      expect(wrapper.emitted('update:sort')).toBeUndefined()
      expect(dialog.open).toBe(true)
    })

    it('emits the chosen axis+direction and closes when a direction is picked', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-axis-millesime"]').setValue(true)
      await wrapper.get('[data-testid="sort-direction-desc"]').trigger('click')

      expect(wrapper.emitted('update:sort')![0]).toEqual([{ sortBy: 'millesime', sortDir: 'desc' }])
      expect(dialog.open).toBe(false)
    })

    it('applies the current axis when only a direction is picked (quick flip)', async () => {
      const wrapper = mountFilterBar(emptySearchFilters, { sortBy: 'status', sortDir: 'asc' })

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-direction-desc"]').trigger('click')

      expect(wrapper.emitted('update:sort')![0]).toEqual([{ sortBy: 'status', sortDir: 'desc' }])
    })

    it('emits nothing when closed via the close button', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-panel-close"]').trigger('click')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:sort')).toBeUndefined()
    })

    it('emits nothing on native cancel (e.g. Escape)', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-panel"]').trigger('cancel')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:sort')).toBeUndefined()
    })

    it('emits nothing when clicking the backdrop', async () => {
      const wrapper = mountFilterBar(emptySearchFilters)
      const dialog = wrapper.get('[data-testid="sort-panel"]').element as HTMLDialogElement

      await openSortPanel(wrapper)
      await wrapper.get('[data-testid="sort-panel"]').trigger('click')

      expect(dialog.open).toBe(false)
      expect(wrapper.emitted('update:sort')).toBeUndefined()
    })
  })

  describe('on a page with no extra filters', () => {
    type HistorySortBy = 'producer' | 'date'
    const emptyCommonFilters: CommonFilters = { mealId: null, appellationId: null, color: null }
    const defaultSort = { sortBy: 'date' as HistorySortBy, sortDir: 'desc' as const }

    function mountPlainFilterBar(filters: CommonFilters) {
      return mount(FilterBar<CommonFilters, HistorySortBy>, {
        props: {
          filters,
          sort: defaultSort,
          appellations,
          meals,
          emptyFilters: emptyCommonFilters,
          sortAxes: [{ sortBy: 'producer' }, { sortBy: 'date' }],
          axisLabel: (sortBy: HistorySortBy) => `label-${sortBy}`,
          defaultSort,
        },
      })
    }

    it('renders no ready-now toggle, inline or in the mobile panel', async () => {
      const wrapper = mountPlainFilterBar(emptyCommonFilters)

      await openPanel(wrapper)

      expect(wrapper.find('[data-testid="ready-now-filter"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="ready-now-filter-mobile"]').exists()).toBe(false)
    })

    it('offers the sort axes and labels given as props', async () => {
      const wrapper = mountPlainFilterBar(emptyCommonFilters)

      await openSortPanel(wrapper)

      expect(wrapper.find('[data-testid="sort-axis-date"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sort-axis-status"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="sort-panel"]').text()).toContain('label-date')
    })

    it('treats the given default sort as default', () => {
      const wrapper = mountPlainFilterBar(emptyCommonFilters)

      expect(wrapper.get('[data-testid="sort-toggle-button"]').text()).not.toMatch(/[↑↓]/)
    })

    it('counts the active common filters', () => {
      const wrapper = mountPlainFilterBar({ ...emptyCommonFilters, mealId: 1, color: 'blanc' })

      expect(wrapper.get('[data-testid="filter-toggle-button"]').text()).toContain('2')
    })

    it('emits the given empty filters when cleared', async () => {
      const wrapper = mountPlainFilterBar({ ...emptyCommonFilters, appellationId: 1 })

      await wrapper.get('[data-testid="clear-filters-button"]').trigger('click')

      expect(wrapper.emitted('update:filters')![0]).toEqual([emptyCommonFilters])
    })
  })
})
