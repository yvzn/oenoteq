import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { setTestLocale } from '../test/i18n'
import { friendlyErrorMessage, friendlyMessageForCode } from './errorMessages'

describe('friendlyErrorMessage', () => {
  it('maps a known error code to its friendly message', () => {
    const error = new ApiError(404, 'wine_not_found')

    expect(friendlyErrorMessage(error)).toBe(
      "Couldn't find that wine. It may have been deleted — go back to the cellar and try again.",
    )
  })

  it('falls back to a generic message for an unmapped code', () => {
    const error = new ApiError(500, 'some_new_backend_code')

    expect(friendlyErrorMessage(error)).toBe('Something went wrong. Please try again.')
  })

  it('passes network errors through as-is', () => {
    const error = new ApiError(0, 'Network error: unable to reach the server')

    expect(friendlyErrorMessage(error)).toBe('Network error: unable to reach the server')
  })

  it('falls back to a generic message for a non-ApiError', () => {
    expect(friendlyErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })
})

describe('friendlyMessageForCode', () => {
  it('maps a known bare code the same way as friendlyErrorMessage', () => {
    expect(friendlyMessageForCode('producer_not_found')).toBe(
      "That producer doesn't exist anymore. Refresh the page and try again.",
    )
  })

  it('falls back to a generic message for an unmapped code', () => {
    expect(friendlyMessageForCode('some_new_backend_code')).toBe('Something went wrong. Please try again.')
  })
})

describe('in French', () => {
  it('maps a known code to its French message', () => {
    setTestLocale('fr')

    expect(friendlyErrorMessage(new ApiError(404, 'producer_not_found'))).toBe(
      "Ce producteur n'existe plus. Actualisez la page et réessayez.",
    )
  })

  it('localizes the network message', () => {
    setTestLocale('fr')

    expect(friendlyErrorMessage(new ApiError(0, 'Network error: unable to reach the server'))).toBe(
      'Erreur réseau : impossible de joindre le serveur.',
    )
  })

  it('shows the generic message in the active language for an unknown code', () => {
    setTestLocale('fr')

    expect(friendlyMessageForCode('some_new_backend_code')).toBe('Une erreur est survenue. Veuillez réessayer.')
  })

  it('does not treat a code that looks like a catalog path as a key', () => {
    expect(friendlyMessageForCode('already_exists.x')).toBe('Something went wrong. Please try again.')
  })
})
