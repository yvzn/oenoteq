export const SUPPORTED_LOCALES = ['en', 'fr'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const FALLBACK_LOCALE: Locale = 'en'

// Each language shown by its own name, so a user can find theirs even when the UI is in the wrong one.
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français' }

// French for any `fr*` preferred language (first entry wins), English otherwise.
export function resolveLocale(preferredLanguages: readonly string[]): Locale {
  const first = preferredLanguages[0]?.toLowerCase()
  return first === 'fr' || first?.startsWith('fr-') ? 'fr' : 'en'
}
