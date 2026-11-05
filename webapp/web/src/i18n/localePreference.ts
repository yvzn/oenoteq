import { readConsent } from '../consent/storageConsent'
import { resolveLocale, SUPPORTED_LOCALES, type Locale } from './locales'

// Where a user's explicit choice is kept (see createConsentAwareOverrideStore for the app's).
export interface LocaleOverrideStore {
  get(): Locale | null
  set(locale: Locale): void
  // Writes a choice made earlier in memory to durable storage, if that is now allowed.
  persist?(): void
}

export const LOCALE_STORAGE_KEY = 'cellar.locale'

// The choice lives in memory for the session; it reaches the device only while Storage
// Consent is granted (ADR 0010). Consent is read on every access, never cached.
export function createConsentAwareOverrideStore(
  storage: () => Storage = () => localStorage,
  isGranted: () => boolean = () => readConsent() === 'granted',
): LocaleOverrideStore {
  const memory = createMemoryOverrideStore()
  const stored = (): Locale | null => {
    if (!isGranted()) return null
    const value = storage().getItem(LOCALE_STORAGE_KEY)
    return SUPPORTED_LOCALES.find((code) => code === value) ?? null
  }
  const persist = () => {
    const locale = memory.get()
    if (locale && isGranted()) storage().setItem(LOCALE_STORAGE_KEY, locale)
  }
  return {
    get: () => memory.get() ?? stored(),
    set: (locale) => {
      memory.set(locale)
      persist()
    },
    persist,
  }
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
  persistOverride(): void
}

export function createLocalePreference(
  browserLanguages: () => readonly string[],
  store: LocaleOverrideStore = createMemoryOverrideStore(),
): LocalePreference {
  return {
    current: () => store.get() ?? resolveLocale(browserLanguages()),
    setOverride: (locale) => store.set(locale),
    persistOverride: () => store.persist?.(),
  }
}
