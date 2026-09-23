import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { useSuccessMessage } from '../composables/useSuccessMessage'
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
