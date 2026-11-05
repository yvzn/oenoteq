import { describe, expect, it } from 'vitest'
import { createConsentAwareOverrideStore, createLocalePreference, LOCALE_STORAGE_KEY, type LocaleOverrideStore } from './localePreference'

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

describe('consent-aware override store', () => {
  function setup(consent: { granted: boolean }) {
    const backing = new Map<string, string>()
    const storage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
    } as Storage
    return { backing, store: createConsentAwareOverrideStore(() => storage, () => consent.granted) }
  }

  it('keeps the choice in memory only without consent', () => {
    const { backing, store } = setup({ granted: false })
    store.set('fr')
    expect(store.get()).toBe('fr')
    expect(backing.size).toBe(0)
  })

  it('stores the choice on the device while consent is granted, and reads it back', () => {
    const { backing, store } = setup({ granted: true })
    store.set('fr')
    expect(backing.get(LOCALE_STORAGE_KEY)).toBe('fr')
    const fresh = createConsentAwareOverrideStore(() => ({ getItem: (k: string) => backing.get(k) ?? null }) as Storage, () => true)
    expect(fresh.get()).toBe('fr')
  })

  it('ignores a stored value that is not a supported language, or that consent no longer covers', () => {
    const consent = { granted: true }
    const { backing, store } = setup(consent)
    backing.set(LOCALE_STORAGE_KEY, 'de')
    expect(store.get()).toBeNull()
    backing.set(LOCALE_STORAGE_KEY, 'fr')
    consent.granted = false
    expect(store.get()).toBeNull()
  })

  it('persists a choice made before consent once consent is granted', () => {
    const consent = { granted: false }
    const { backing, store } = setup(consent)
    store.set('fr')
    consent.granted = true
    store.persist?.()
    expect(backing.get(LOCALE_STORAGE_KEY)).toBe('fr')
  })
})
