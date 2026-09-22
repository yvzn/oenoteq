import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AutocompleteField from './AutocompleteField.vue'

const items = [
  { id: 1, name: 'Chinon' },
  { id: 2, name: 'Sancerre' },
  { id: 3, name: 'Saumur-Champigny' },
]

describe('AutocompleteField', () => {
  it('lists all items when the input is empty', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    await wrapper.find('[data-testid="appellation-filter-input"]').trigger('focus')

    expect(wrapper.findAll('[data-testid="appellation-filter-option"]')).toHaveLength(3)
  })

  it('narrows the options as the user types', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.find('[data-testid="appellation-filter-input"]')
    await input.setValue('sa')

    const options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options).toHaveLength(2)
    expect(options.map((o) => o.text())).toEqual(['Sancerre', 'Saumur-Champigny'])
  })

  it('emits the id of the selected item and displays its name', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.find('[data-testid="appellation-filter-input"]')
    await input.setValue('sa')
    await wrapper.findAll('[data-testid="appellation-filter-option"]')[0]!.trigger('mousedown')

    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect((input.element as HTMLInputElement).value).toBe('Sancerre')
  })

  it('emits null when the input is cleared', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: 1, testid: 'appellation-filter' },
    })
    const input = wrapper.find('[data-testid="appellation-filter-input"]')
    await input.setValue('')

    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })
})
