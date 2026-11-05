import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from './ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('is closed when the open prop is false', () => {
    const wrapper = mount(ConfirmDialog, { props: { open: false, message: 'Delete this?' } })
    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement

    expect(dialog.open).toBe(false)
  })

  it('opens and shows the message when the open prop is true', () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, message: 'Delete "Cheese plate"?' } })
    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement

    expect(dialog.open).toBe(true)
    expect(wrapper.text()).toContain('Delete "Cheese plate"?')
  })

  it('emits cancel and performs no other action when cancel is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, message: 'Delete this?' } })

    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits confirm when confirm is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, message: 'Delete this?' } })

    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('emits cancel when the native cancel event fires (e.g. Escape)', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, message: 'Delete this?' } })

    await wrapper.get('[data-testid="confirm-dialog"]').trigger('cancel')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel when clicking outside the dialog content', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: true, message: 'Delete this?' } })

    await wrapper.get('[data-testid="confirm-dialog"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('opens/closes when the open prop changes after mount', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: false, message: 'Delete this?' } })
    const dialog = wrapper.get('[data-testid="confirm-dialog"]').element as HTMLDialogElement

    await wrapper.setProps({ open: true })
    expect(dialog.open).toBe(true)

    await wrapper.setProps({ open: false })
    expect(dialog.open).toBe(false)
  })

  it('supports custom confirm/cancel labels', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, message: 'Delete this?', confirmLabel: 'Delete', cancelLabel: 'Keep it' },
    })

    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').text()).toBe('Delete')
    expect(wrapper.get('[data-testid="confirm-dialog-cancel"]').text()).toBe('Keep it')
  })
})
