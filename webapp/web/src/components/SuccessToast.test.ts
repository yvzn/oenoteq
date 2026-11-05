import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { setTestLocale } from '../test/i18n'
import SuccessToast from './SuccessToast.vue'

afterEach(() => {
  useSuccessMessage().clear()
})

describe('SuccessToast', () => {
  it('renders nothing when there is no message', () => {
    const wrapper = mount(SuccessToast)

    expect(wrapper.find('[data-testid="success-toast"]').exists()).toBe(false)
  })

  it('shows the message once one is set', async () => {
    const wrapper = mount(SuccessToast)

    useSuccessMessage().show('Wine added.')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="success-toast"]').text()).toContain('Wine added.')
  })

  it('clears the message when the dismiss button is clicked', async () => {
    const wrapper = mount(SuccessToast)
    useSuccessMessage().show('Wine added.')
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="success-toast-dismiss"]').trigger('click')

    expect(wrapper.find('[data-testid="success-toast"]').exists()).toBe(false)
    expect(useSuccessMessage().message.value).toBeNull()
  })
})

describe('SuccessToast queue', () => {
  it('shows one message at a time and advances on dismiss', async () => {
    const wrapper = mount(SuccessToast)
    useSuccessMessage().show('First.')
    useSuccessMessage().show('Second.')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="success-toast"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="success-toast"]').text()).toContain('First.')

    await wrapper.get('[data-testid="success-toast-dismiss"]').trigger('click')

    expect(wrapper.get('[data-testid="success-toast"]').text()).toContain('Second.')

    await wrapper.get('[data-testid="success-toast-dismiss"]').trigger('click')

    expect(wrapper.find('[data-testid="success-toast"]').exists()).toBe(false)
  })
})

describe('SuccessToast in French', () => {
  it('shows the dismiss control in French', async () => {
    setTestLocale('fr')
    const wrapper = mount(SuccessToast)
    useSuccessMessage().show('Vin ajouté.')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="success-toast-dismiss"]').text()).toBe('Fermer')
  })
})
