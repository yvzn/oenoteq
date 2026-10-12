import { watchEffect } from 'vue'
import { useLocale } from './useLocale'

// Keep <html lang> and the tab title in step with the active language.
export function useDocumentLocale() {
  const { locale, t } = useLocale()
  watchEffect(() => {
    document.documentElement.lang = locale.value
    document.title = t('document.title')
  })
}
