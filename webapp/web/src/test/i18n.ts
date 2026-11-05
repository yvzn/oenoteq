import { config } from '@vue/test-utils'
import { beforeEach } from 'vitest'
import { createAppI18n } from '../i18n'
import type { Locale } from '../i18n/locales'

// A missing key during a test is a bug in the catalog, not a blemish: fail loudly.
function make(locale: Locale) {
  return createAppI18n(locale, {
    onMissing: (loc, key) => {
      throw new Error(`Missing i18n key "${key}" for locale "${loc}"`)
    },
  })
}

let current: ReturnType<typeof make>

// Every mounted test gets the plugin with the locale pinned to English.
beforeEach(() => {
  current = make('en')
  config.global.plugins = [current]
})

// Tests that need another language switch the shared instance through this seam.
export function setTestLocale(locale: Locale) {
  current.global.locale.value = locale
}
