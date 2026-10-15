// The Storage Consent record (ADR 0010): the one thing kept on the device
// before the user has chosen, and the single source of the app's data path.
export type ConsentChoice = 'granted' | 'refused'
export type ConsentState = ConsentChoice | 'no-choice'

// Bump to ask every user again (a changed consent text or scope).
export const CONSENT_VERSION = 1

export const CONSENT_STORAGE_KEY = 'cellar.storage-consent'

interface ConsentRecord {
  choice: ConsentChoice
  version: number
  timestamp: string
}

function parseRecord(raw: string | null): ConsentRecord | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { choice, version, timestamp } = value as Record<string, unknown>
    if (choice !== 'granted' && choice !== 'refused') return null
    if (typeof version !== 'number' || typeof timestamp !== 'string') return null
    return { choice, version, timestamp }
  } catch {
    return null
  }
}

// Synchronous so boot can decide before touching any other storage. An
// absent or unreadable record, or one for an older consent text, is "no choice yet".
export function readConsent(): ConsentState {
  let raw: string | null
  try {
    raw = localStorage.getItem(CONSENT_STORAGE_KEY)
  } catch {
    return 'no-choice'
  }
  const record = parseRecord(raw)
  if (!record || record.version < CONSENT_VERSION) return 'no-choice'
  return record.choice
}

const listeners = new Set<(state: ConsentState) => void>()

export function writeConsent(choice: ConsentChoice): void {
  const record: ConsentRecord = { choice, version: CONSENT_VERSION, timestamp: new Date().toISOString() }
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  for (const listener of listeners) listener(choice)
}

// Fires for a change made in this tab and, through storage events, in any other.
export function onConsentChange(listener: (state: ConsentState) => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) listener(readConsent())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Offline Mode (local store, outbox, sync, service worker) exists only with consent.
export function isOfflineMode(): boolean {
  return readConsent() === 'granted'
}
