import { describe, expect, it } from 'vitest'
import { createAppI18n } from '.'
import { messageRef } from './messageRef'

describe('plural rules', () => {
  it('treats zero as singular in French and plural in English', () => {
    const fr = createAppI18n('fr')
    const en = createAppI18n('en')
    fr.global.setLocaleMessage('fr', { wines: '{count} vin | {count} vins' } as never)
    en.global.setLocaleMessage('en', { wines: '{count} wine | {count} wines' } as never)

    expect(fr.global.t('wines', 0)).toBe('0 vin')
    expect(fr.global.t('wines', 2)).toBe('2 vins')
    expect(en.global.t('wines', 0)).toBe('0 wines')
    expect(en.global.t('wines', 1)).toBe('1 wine')
  })
})

describe('messageRef', () => {
  it('carries a key plus parameters the view can translate', () => {
    const i18n = createAppI18n('en')
    i18n.global.setLocaleMessage('en', { too_long: 'At most {max} characters.' } as never)
    const ref = messageRef('too_long', { max: 5 })
    expect(i18n.global.t(ref.key, ref.params ?? {})).toBe('At most 5 characters.')
  })
})
