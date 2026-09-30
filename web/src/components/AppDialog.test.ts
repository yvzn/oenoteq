import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppDialog from './AppDialog.vue'

describe('AppDialog', () => {
  it('is closed when the open prop is false', () => {
    const wrapper = mount(AppDialog, { props: { open: false } })
    const dialog = wrapper.get('[data-testid="app-dialog"]').element as HTMLDialogElement

    expect(dialog.open).toBe(false)
  })

  it('opens and renders slot content when the open prop is true', () => {
    const wrapper = mount(AppDialog, {
      props: { open: true },
      slots: { default: '<p>Adjust quantity</p>' },
    })
    const dialog = wrapper.get('[data-testid="app-dialog"]').element as HTMLDialogElement

    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Adjust quantity')
  })

  it('opens/closes when the open prop changes after mount', async () => {
    const wrapper = mount(AppDialog, { props: { open: false } })
    const dialog = wrapper.get('[data-testid="app-dialog"]').element as HTMLDialogElement

    await wrapper.setProps({ open: true })
    expect(dialog.open).toBe(true)

    await wrapper.setProps({ open: false })
    expect(dialog.open).toBe(false)
  })

  it('emits cancel when the native cancel event fires (e.g. Escape)', async () => {
    const wrapper = mount(AppDialog, { props: { open: true } })

    await wrapper.get('[data-testid="app-dialog"]').trigger('cancel')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel when clicking outside the dialog content', async () => {
    const wrapper = mount(AppDialog, { props: { open: true } })

    await wrapper.get('[data-testid="app-dialog"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
