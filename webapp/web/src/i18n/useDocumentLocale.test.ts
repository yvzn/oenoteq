import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { useDocumentLocale } from './useDocumentLocale'
import { useLocale } from './useLocale'

describe('useDocumentLocale', () => {
  it('keeps <html lang> and the document title in step with the active locale', async () => {
    let setLocale: ReturnType<typeof useLocale>['setLocale'] = () => {}
    mount(
      defineComponent({
        setup() {
          useDocumentLocale()
          setLocale = useLocale().setLocale
          return () => null
        },
      }),
    )
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Oenoteq – Wine Cellar Tracker')

    setLocale('fr')
    await nextTick()

    expect(document.documentElement.lang).toBe('fr')
    expect(document.title).toBe('Oenoteq – Suivi de cave à vin')
  })
})
