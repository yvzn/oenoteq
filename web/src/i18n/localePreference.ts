import { resolveLocale, type Locale } from './locales'

// Where a user's explicit choice is kept. Memory-only until Storage Consent exists (ADR 0010);
// a persisted store can be swapped in behind this interface once consent is granted.
export interface LocaleOverrideStore {
  get(): Locale | null
  set(locale: Locale): void
}

export function createMemoryOverrideStore(): LocaleOverrideStore {
  let override: Locale | null = null
  return {
    get: () => override,
    set: (locale) => {
      override = locale
    },
  }
}

export interface LocalePreference {
  current(): Locale
  setOverride(locale: Locale): void
}

export function createLocalePreference(
  browserLanguages: () => readonly string[],
  store: LocaleOverrideStore = createMemoryOverrideStore(),
): LocalePreference {
  return {
    current: () => store.get() ?? resolveLocale(browserLanguages()),
    setOverride: (locale) => store.set(locale),
  }
}
