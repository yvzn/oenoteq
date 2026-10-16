import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { resetSuccessMessageAfterEach, withAutoClear } from '../test/successMessageRouter'
import { useSuccessMessage } from './useSuccessMessage'

resetSuccessMessageAfterEach()

function makeRouter() {
  const Blank = defineComponent({ template: '<div />' })
  return withAutoClear(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/a', name: 'a', component: Blank },
        { path: '/b/:id', name: 'b', component: Blank },
      ],
    }),
  )
}

describe('useSuccessMessage', () => {
  it('sets the message on show', () => {
    const { message, show } = useSuccessMessage()

    show('Saved.')

    expect(message.value).toBe('Saved.')
  })

  it('clears the message immediately when clear is called', () => {
    const { message, show, clear } = useSuccessMessage()

    show('Saved.')
    clear()

    expect(message.value).toBeNull()
  })

  it('queues messages first-in first-out instead of replacing', () => {
    const { message, show, dismiss } = useSuccessMessage()

    show('First.')
    show('Second.')
    expect(message.value).toBe('First.')

    dismiss()
    expect(message.value).toBe('Second.')

    dismiss()
    expect(message.value).toBeNull()
  })

  it('clears every queued message when clear is called', () => {
    const { message, show, clear } = useSuccessMessage()

    show('First.')
    show('Second.')
    clear()

    expect(message.value).toBeNull()
  })

  it('survives the navigation triggered by showAndNavigate', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, showAndNavigate } = useSuccessMessage()
    await showAndNavigate('Wine added.', { name: 'b', params: { id: '1' } }, router)

    expect(message.value).toBe('Wine added.')
    expect(router.currentRoute.value.fullPath).toBe('/b/1')
  })

  it('clears on the next navigation after the carried one', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, showAndNavigate } = useSuccessMessage()
    await showAndNavigate('Wine added.', { name: 'b', params: { id: '1' } }, router)
    expect(message.value).toBe('Wine added.')

    await router.push({ name: 'b', params: { id: '2' } })

    expect(message.value).toBeNull()
  })

  it('clears on navigation when the message was shown in place, not carried', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, show } = useSuccessMessage()
    show('Consumption recorded.')
    expect(message.value).toBe('Consumption recorded.')

    await router.push({ name: 'b', params: { id: '1' } })

    expect(message.value).toBeNull()
  })

  it('drops queued messages but keeps the carried one on navigation', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, show, showAndNavigate, dismiss } = useSuccessMessage()
    show('Stale.')
    await showAndNavigate('Wine added.', { name: 'b', params: { id: '1' } }, router)

    expect(message.value).toBe('Wine added.')
    dismiss()
    expect(message.value).toBeNull()
  })

  it('clears every queued message on navigation', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, show } = useSuccessMessage()
    show('First.')
    show('Second.')

    await router.push({ name: 'b', params: { id: '1' } })

    expect(message.value).toBeNull()
  })

  it('does not bring back a carried message that was dismissed before navigation', async () => {
    const router = makeRouter()
    router.push('/a')
    await router.isReady()

    const { message, showAndNavigate, dismiss } = useSuccessMessage()
    const pending = showAndNavigate('Wine added.', { name: 'b', params: { id: '1' } }, router)
    dismiss()
    await pending
    await router.push({ name: 'b', params: { id: '2' } })

    expect(message.value).toBeNull()
  })
})
