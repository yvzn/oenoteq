import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { friendlyErrorMessage } from './errorMessages'

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
