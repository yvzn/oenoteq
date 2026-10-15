import { preference } from '../i18n'
import { LOCALE_STORAGE_KEY } from '../i18n/localePreference'
import { registerPwaUpdates } from '../registerPwa'
import { writeConsent } from './storageConsent'

// Turns Offline Mode on: records the choice, keeps the language chosen so far, and
// registers the service worker. The local store opens on first use from here on.
export function grantConsent(): void {
  writeConsent('granted')
  preference.persistOverride()
  registerPwaUpdates()
}

// A language kept from an earlier grant no longer has consent behind it.
export function refuseConsent(): void {
  writeConsent('refused')
  localStorage.removeItem(LOCALE_STORAGE_KEY)
}
