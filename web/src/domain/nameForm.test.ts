import { describe, expect, it } from 'vitest'
import { validateName } from './nameForm'

describe('validateName', () => {
  it('accepts a non-empty name', () => {
    expect(validateName('Chinon')).toBeUndefined()
  })

  it('rejects an empty or whitespace-only name with a message key', () => {
    expect(validateName('')).toEqual({ key: 'manage.common.nameRequired' })
    expect(validateName('   ')).toEqual({ key: 'manage.common.nameRequired' })
  })
})
