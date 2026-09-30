import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NumberStepper from './NumberStepper.vue'

describe('NumberStepper', () => {
  it('increments and decrements the model value by the step size', async () => {
    const wrapper = mount(NumberStepper, {
      props: {
        modelValue: '3',
        inputTestid: 'stepper-input',
        decrementTestid: 'stepper-decrement',
        incrementTestid: 'stepper-increment',
      },
    })

    await wrapper.get('[data-testid="stepper-increment"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['4'])

    await wrapper.setProps({ modelValue: '4' })
    await wrapper.get('[data-testid="stepper-decrement"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['3'])
  })

  it('treats an empty value as zero when stepping', async () => {
    const wrapper = mount(NumberStepper, {
      props: {
        modelValue: '',
        inputTestid: 'stepper-input',
        decrementTestid: 'stepper-decrement',
        incrementTestid: 'stepper-increment',
      },
    })

    await wrapper.get('[data-testid="stepper-increment"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1'])
  })

  it('clamps to min and max when provided', async () => {
    const wrapper = mount(NumberStepper, {
      props: {
        modelValue: '4',
        min: 1,
        max: 5,
        inputTestid: 'stepper-input',
        decrementTestid: 'stepper-decrement',
        incrementTestid: 'stepper-increment',
      },
    })

    // 4 -> 5 (within range), then clamped at 5 (no further change emitted)
    await wrapper.get('[data-testid="stepper-increment"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['5'])
    await wrapper.setProps({ modelValue: '5' })
    await wrapper.get('[data-testid="stepper-increment"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)

    // 5 -> ... -> clamped at 1 (no further change emitted below the floor)
    await wrapper.setProps({ modelValue: '2' })
    await wrapper.get('[data-testid="stepper-decrement"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['1'])
    await wrapper.setProps({ modelValue: '1' })
    await wrapper.get('[data-testid="stepper-decrement"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(2)
  })

  it('does not clamp when no min/max is given, allowing negative deltas', async () => {
    const wrapper = mount(NumberStepper, {
      props: {
        modelValue: '0',
        inputTestid: 'stepper-input',
        decrementTestid: 'stepper-decrement',
        incrementTestid: 'stepper-increment',
      },
    })

    await wrapper.get('[data-testid="stepper-decrement"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['-1'])
  })
})
