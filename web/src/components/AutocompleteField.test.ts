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

  it('exposes combobox/listbox ARIA wiring', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('false')

    await input.trigger('focus')
    const list = wrapper.get('[data-testid="appellation-filter-options"]')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(input.attributes('aria-controls')).toBe(list.attributes('id'))
    expect(list.attributes('role')).toBe('listbox')

    await input.trigger('keydown', { key: 'ArrowDown' })
    const options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options[0]!.attributes('role')).toBe('option')
    expect(options[0]!.attributes('aria-selected')).toBe('true')
    expect(input.attributes('aria-activedescendant')).toBe(options[0]!.attributes('id'))
  })

  it('moves the highlight down with ArrowDown, wrapping to the first option after the last', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')
    await input.trigger('focus')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    let options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options[2]!.attributes('aria-selected')).toBe('true')

    await input.trigger('keydown', { key: 'ArrowDown' })
    options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options[0]!.attributes('aria-selected')).toBe('true')
  })

  it('opens the list and highlights the last option on ArrowUp when closed, then wraps upward', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')

    await input.trigger('keydown', { key: 'ArrowUp' })
    let options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options).toHaveLength(3)
    expect(options[2]!.attributes('aria-selected')).toBe('true')

    await input.trigger('keydown', { key: 'ArrowUp' })
    options = wrapper.findAll('[data-testid="appellation-filter-option"]')
    expect(options[1]!.attributes('aria-selected')).toBe('true')
  })

  it('selects the highlighted option on Enter', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')
    await input.trigger('focus')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect((input.element as HTMLInputElement).value).toBe('Sancerre')
    expect(wrapper.find('[data-testid="appellation-filter-options"]').exists()).toBe(false)
  })

  it('does nothing on Enter when no option is highlighted', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: null, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')
    await input.trigger('focus')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes the list and reverts the query text to the current selection on Escape', async () => {
    const wrapper = mount(AutocompleteField, {
      props: { items, modelValue: 1, testid: 'appellation-filter' },
    })
    const input = wrapper.get('[data-testid="appellation-filter-input"]')
    await input.setValue('xyz')
    await input.trigger('keydown', { key: 'Escape' })

    expect((input.element as HTMLInputElement).value).toBe('Chinon')
    expect(wrapper.find('[data-testid="appellation-filter-options"]').exists()).toBe(false)
  })
})
