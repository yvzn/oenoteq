import { reloadInto } from './consent/reload'
import { isOfflineMode, onOtherTabConsentChange, readConsent } from './consent/storageConsent'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'

// Decides from the Storage Consent record, before touching any storage, whether
// Offline Mode's background machinery runs. Without consent there is no sync,
// no service worker and no local store — and no install affordance either.
// A consent change made in another tab reloads this one into the new mode, so it never
// keeps writing to a store that was just deleted (or reading one that no longer applies).
function followConsentChangesInOtherTabs(): () => void {
  const bootState = readConsent()
  return onOtherTabConsentChange((state) => {
    if (state !== bootState) reloadInto(location.pathname + location.search + location.hash)
  })
}

// Returns what stops following consent changes, for tests.
export function startBackgroundServices(): () => void {
  const stopFollowing = followConsentChangesInOtherTabs()
  if (!isOfflineMode()) {
    // The manifest is what makes the browser offer "install app".
    document.querySelector('link[rel="manifest"]')?.remove()
    return stopFollowing
  }
  startSync()
  registerPwaUpdates()
  return stopFollowing
}
