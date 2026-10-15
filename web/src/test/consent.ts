import { afterEach, beforeEach, it } from 'vitest'
import { CONSENT_STORAGE_KEY, CONSENT_VERSION, type ConsentState } from '../consent/storageConsent'

// Sets the Storage Consent record the way a returning user would have left it.
export function setConsent(state: ConsentState): void {
  if (state === 'no-choice') localStorage.removeItem(CONSENT_STORAGE_KEY)
  else
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ choice: state, version: CONSENT_VERSION, timestamp: '2026-01-01T00:00:00.000Z' }),
    )
}

// The vitest `online-only` project re-runs the view suites with a refused record
// (see vite.config.ts); every other run is a user who granted storage. A test
// may still override either with setConsent().
export const defaultConsent: ConsentState = import.meta.env.TEST_CONSENT === 'refused' ? 'refused' : 'granted'

// For tests about what only exists with a local store (outbox, local ids,
// offline copy, pending badges): skipped when the suite runs online-only.
export const itOfflineOnly = defaultConsent === 'granted' ? it : it.skip

// Counterpart: for tests about what only exists without a local store (the server's search).
export const itOnlineOnly = defaultConsent === 'refused' ? it : it.skip

beforeEach(() => setConsent(defaultConsent))
afterEach(() => localStorage.clear())
