import { describe, expect, it } from 'vitest'
import { resolveLocale } from './locales'

describe('resolveLocale', () => {
  it.each([['fr'], ['fr-FR'], ['fr-CA']])('resolves %s to French', (tag) => {
    expect(resolveLocale([tag])).toBe('fr')
  })

  it.each([[['en-US']], [['de-DE']], [[]]])('resolves %j to English', (languages) => {
    expect(resolveLocale(languages)).toBe('en')
  })

  it('uses the most preferred language', () => {
    expect(resolveLocale(['en-US', 'fr'])).toBe('en')
    expect(resolveLocale(['fr-FR', 'en'])).toBe('fr')
  })
})
