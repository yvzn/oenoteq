import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  isOfflineMode,
  onConsentChange,
  readConsent,
  writeConsent,
} from './storageConsent'

beforeEach(() => localStorage.clear())

function store(record: unknown) {
  localStorage.setItem(CONSENT_STORAGE_KEY, typeof record === 'string' ? record : JSON.stringify(record))
}

describe('storageConsent', () => {
  it('is "no-choice" when nothing is stored', () => {
    expect(readConsent()).toBe('no-choice')
    expect(isOfflineMode()).toBe(false)
  })

  it('reads back what was written', () => {
    writeConsent('refused')
    expect(readConsent()).toBe('refused')
    expect(isOfflineMode()).toBe(false)

    writeConsent('granted')
    expect(readConsent()).toBe('granted')
    expect(isOfflineMode()).toBe(true)
  })

  it('records the current version and a timestamp', () => {
    writeConsent('granted')

    const record = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!)
    expect(record).toMatchObject({ choice: 'granted', version: CONSENT_VERSION })
    expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false)
  })

  it.each([
    ['not JSON', 'oops{'],
    ['not an object', '42'],
    ['unknown choice', { choice: 'maybe', version: CONSENT_VERSION, timestamp: 't' }],
    ['missing version', { choice: 'granted', timestamp: 't' }],
    ['missing timestamp', { choice: 'granted', version: CONSENT_VERSION }],
  ])('treats an unreadable record (%s) as no choice', (_label, record) => {
    store(record)
    expect(readConsent()).toBe('no-choice')
  })

  it('treats a record for an older consent text as no choice', () => {
    store({ choice: 'granted', version: CONSENT_VERSION - 1, timestamp: 't' })
    expect(readConsent()).toBe('no-choice')
  })

  it('notifies listeners of a change in this tab until unsubscribed', () => {
    const listener = vi.fn()
    const off = onConsentChange(listener)

    writeConsent('granted')
    off()
    writeConsent('refused')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('granted')
  })

  it('notifies listeners of a change made in another tab', () => {
    const listener = vi.fn()
    const off = onConsentChange(listener)
    store({ choice: 'refused', version: CONSENT_VERSION, timestamp: 't' })

    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY }))
    off()

    expect(listener).toHaveBeenCalledWith('refused')
  })
})
