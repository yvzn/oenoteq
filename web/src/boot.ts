import { isOfflineMode } from './consent/storageConsent'
import { registerPwaUpdates } from './registerPwa'
import { startSync } from './sync'

// Decides from the Storage Consent record, before touching any storage, whether
// Offline Mode's background machinery runs. Without consent there is no sync,
// no service worker and no local store — and no install affordance either.
export function startBackgroundServices(): void {
  if (!isOfflineMode()) {
    // The manifest is what makes the browser offer "install app".
    document.querySelector('link[rel="manifest"]')?.remove()
    return
  }
  startSync()
  registerPwaUpdates()
}
