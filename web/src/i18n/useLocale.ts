import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { preference } from '.'
import type { Locale } from './locales'

export function useLocale() {
  const { locale, t } = useI18n()

  // Switch the active language; the choice is remembered by the preference module.
  function setLocale(next: Locale) {
    preference.setOverride(next)
    locale.value = next
  }

  return { locale: locale as unknown as Ref<Locale>, setLocale, t }
}
