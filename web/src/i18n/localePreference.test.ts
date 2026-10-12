import { describe, expect, it } from 'vitest'
import { createLocalePreference, type LocaleOverrideStore } from './localePreference'

describe('locale preference', () => {
  it('follows the browser language by default', () => {
    expect(createLocalePreference(() => ['fr-FR']).current()).toBe('fr')
    expect(createLocalePreference(() => ['en-US']).current()).toBe('en')
  })

  it('lets the user override beat the browser default', () => {
    const preference = createLocalePreference(() => ['fr-FR'])
    preference.setOverride('en')
    expect(preference.current()).toBe('en')
  })

  it('keeps the override in memory only by default', () => {
    createLocalePreference(() => ['en']).setOverride('fr')
    expect(createLocalePreference(() => ['en']).current()).toBe('en')
  })

  it('accepts a different store behind the interface', () => {
    const saved: string[] = []
    const store: LocaleOverrideStore = { get: () => 'fr', set: (l) => void saved.push(l) }
    const preference = createLocalePreference(() => ['en'], store)
    expect(preference.current()).toBe('fr')
    preference.setOverride('en')
    expect(saved).toEqual(['en'])
  })
})
