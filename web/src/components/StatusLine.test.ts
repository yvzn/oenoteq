import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusLine from './StatusLine.vue'

describe('StatusLine', () => {
  it('renders the retry slot in error tone', () => {
    const wrapper = mount(StatusLine, {
      props: { tone: 'error' },
      slots: { default: 'Boom', retry: '<button data-testid="retry">Retry</button>' },
    })

    expect(wrapper.find('[data-testid="retry"]').exists()).toBe(true)
  })

  it('does not render the retry slot in muted tone', () => {
    const wrapper = mount(StatusLine, {
      props: { tone: 'muted' },
      slots: { default: 'Loading', retry: '<button data-testid="retry">Retry</button>' },
    })

    expect(wrapper.find('[data-testid="retry"]').exists()).toBe(false)
  })
})
