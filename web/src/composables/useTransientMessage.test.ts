import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransientMessage } from './useTransientMessage'

const DURATION_MS = 3000

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTransientMessage', () => {
  it('sets the message on show', () => {
    const { message, show } = useTransientMessage()

    show('Saved.')

    expect(message.value).toBe('Saved.')
  })

  it('clears the message automatically after the duration', () => {
    const { message, show } = useTransientMessage()

    show('Saved.')
    vi.advanceTimersByTime(DURATION_MS - 1)
    expect(message.value).toBe('Saved.')

    vi.advanceTimersByTime(1)
    expect(message.value).toBeNull()
  })

  it('restarts the timer when shown again before it elapses', () => {
    const { message, show } = useTransientMessage()

    show('First.')
    vi.advanceTimersByTime(DURATION_MS - 500)
    show('Second.')
    vi.advanceTimersByTime(DURATION_MS - 500)

    expect(message.value).toBe('Second.')

    vi.advanceTimersByTime(500)
    expect(message.value).toBeNull()
  })

  it('clears the message immediately when clear is called', () => {
    const { message, show, clear } = useTransientMessage()

    show('Saved.')
    clear()

    expect(message.value).toBeNull()
  })
})
