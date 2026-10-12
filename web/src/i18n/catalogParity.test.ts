import { describe, expect, it } from 'vitest'
import { messages } from '.'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) }
  }, {})
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

describe('catalog parity', () => {
  const en = flatten(messages.en)
  const fr = flatten(messages.fr)

  it('has every key in both languages', () => {
    const keys = [...new Set([...Object.keys(en), ...Object.keys(fr)])]
    expect(keys.filter((k) => !(k in en) || !(k in fr))).toEqual([])
  })

  it('uses the same placeholder names in both languages', () => {
    const mismatched = Object.keys(en).filter(
      (k) => k in fr && placeholders(en[k]).join() !== placeholders(fr[k]).join(),
    )
    expect(mismatched).toEqual([])
  })
})
