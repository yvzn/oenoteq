import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { setTestLocale } from '../test/i18n'
import ColorSwatch from './ColorSwatch.vue'

describe('ColorSwatch', () => {
  it('labels the stored color in English', () => {
    expect(mount(ColorSwatch, { props: { color: 'rouge' } }).attributes('title')).toBe('Red')
    expect(mount(ColorSwatch, { props: { color: 'rose' } }).attributes('title')).toBe('Rosé')
  })

  it('labels the stored color in French', () => {
    setTestLocale('fr')

    expect(mount(ColorSwatch, { props: { color: 'rouge' } }).attributes('title')).toBe('Rouge')
    expect(mount(ColorSwatch, { props: { color: 'blanc', variant: 'rail' } }).attributes('title')).toBe('Blanc')
  })
})
