import { hasMessage, translate } from '../i18n'
import { ApiError } from './client'

// Backend error codes (see internal/handlers/handlers.go) map to `errors.<code>` catalog keys: copy
// that says what happened and what to do next, in the active language. Translated when called, so
// this works outside components too.

// Same mapping, taking the bare backend code directly rather than an
// ApiError — used for outbox items, whose stored error is already just that
// code string (see sync/outbox.ts's replay()).
export function friendlyMessageForCode(code: string): string {
  // Only plain identifiers can be codes; anything else would address a different catalog path.
  const known = /^\w+$/.test(code) && hasMessage(`errors.${code}`)
  return translate(known ? `errors.${code}` : 'errors.generic')
}

export function friendlyErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return translate('errors.generic')
  if (error.status === 0) return translate('errors.network')
  return friendlyMessageForCode(error.message)
}
