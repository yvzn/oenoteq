import { computed, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import { createConsentAwareOverrideStore, createLocalePreference } from './localePreference'
import { FALLBACK_LOCALE, type Locale } from './locales'
import en from './messages/en'
import fr from './messages/fr'

export const messages = { en, fr }

export const preference = createLocalePreference(() => navigator.languages ?? [], createConsentAwareOverrideStore())

// French has no distinct "zero" form: 0 reads as singular ("0 vin"). Choices are ordered [one, other].
function frenchPlural(choice: number, choicesLength: number): number {
  if (choicesLength === 2) return choice === 0 || choice === 1 ? 0 : 1
  return Math.min(choice, choicesLength - 1)
}

function build(locale: Locale, onMissing?: (locale: string, key: string) => void) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: FALLBACK_LOCALE,
    messages,
    pluralRules: { fr: frenchPlural },
    missing: onMissing,
  })
}

// The most recently created instance is the one the app (or the current test) runs on. Code outside
// components (composables, error mapping) translates through it, so it follows the active locale.
const active = shallowRef<ReturnType<typeof build>['global'] | null>(null)

export function createAppI18n(
  locale: Locale = preference.current(),
  options: { onMissing?: (locale: string, key: string) => void } = {},
) {
  const i18n = build(locale, options.onMissing)
  active.value = i18n.global
  return i18n
}

// Reactive: re-evaluates whenever the active locale changes.
export const activeLocale = computed<Locale>(() => (active.value?.locale.value ?? FALLBACK_LOCALE) as Locale)

export function translate(key: string, params?: Record<string, string | number>, plural?: number): string {
  if (!active.value) throw new Error('i18n is not initialised')
  return plural === undefined ? active.value.t(key, params ?? {}) : active.value.t(key, params ?? {}, plural)
}

// Whether the English catalog (the complete one) defines this key.
export function hasMessage(key: string): boolean {
  return active.value?.te(key, FALLBACK_LOCALE) ?? false
}
