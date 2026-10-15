import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/localDb'
import { pushChangesInBackground, refreshInBackground, startSync, syncNow } from './index'
import { pullAllMealPairings } from './mealPairingSync'
import { pullProducers, pushProducers } from './producerSync'

vi.mock('./appellationSync', () => ({ pullAppellations: vi.fn(), pushAppellations: vi.fn() }))
vi.mock('./consumptionSync', () => ({ pushConsumptions: vi.fn() }))
vi.mock('./mealPairingSync', () => ({ pullAllMealPairings: vi.fn(async () => {}), pushMealPairings: vi.fn() }))
vi.mock('./mealSync', () => ({ pullMeals: vi.fn(), pushMeals: vi.fn() }))
vi.mock('./producerSync', () => ({ pullProducers: vi.fn(), pushProducers: vi.fn() }))
vi.mock('./wineSync', () => ({ pullWines: vi.fn(), pushWines: vi.fn() }))

const MINUTE = 60_000
// The throttle clock is module state, so every test starts well past the previous test's last run.
let clock = new Date('2026-01-01T00:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock += 60 * MINUTE
  vi.setSystemTime(clock)
  vi.mocked(pullProducers).mockReset()
  vi.mocked(pushProducers).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const pulls = () => vi.mocked(pullProducers).mock.calls.length
const advance = (ms: number) => vi.setSystemTime(Date.now() + ms)

function setOnline(online: boolean) {
  vi.stubGlobal('navigator', { ...navigator, onLine: online })
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe('syncNow', () => {
  it('reports progress after each step, ending at total', async () => {
    const progress: Array<[number, number]> = []
    await syncNow((done, total) => progress.push([done, total]))
    const total = progress[0][1]
    expect(progress.map(([done]) => done)).toEqual(Array.from({ length: total }, (_, i) => i + 1))
  })

  it('rejects when a step fails, without reporting further progress', async () => {
    vi.mocked(pullProducers).mockRejectedValueOnce(new Error('offline'))
    const onProgress = vi.fn()
    await expect(syncNow(onProgress)).rejects.toThrow('offline')
    expect(onProgress).toHaveBeenCalledTimes(1) // the push step only
  })

  it('pushes the outbox before pulling anything', async () => {
    const order: string[] = []
    vi.mocked(pushProducers).mockImplementation(async () => void order.push('push'))
    vi.mocked(pullProducers).mockImplementation(async () => void order.push('pull'))

    await syncNow()

    expect(order).toEqual(['push', 'pull'])
  })

  it('does not start a pull while a background push is still in flight', async () => {
    const push = deferred()
    vi.mocked(pushProducers).mockReturnValueOnce(push.promise)
    pushChangesInBackground()

    const sync = syncNow()
    await new Promise((r) => setTimeout(r, 20))
    expect(pulls()).toBe(0)

    push.resolve()
    await sync
    expect(pulls()).toBe(1)
  })

  it('never overlaps two refreshes: a second request joins the one in flight', async () => {
    const slowPull = deferred()
    vi.mocked(pullProducers).mockReturnValueOnce(slowPull.promise)

    const first = syncNow()
    const second = syncNow()
    await new Promise((r) => setTimeout(r, 20))
    slowPull.resolve()
    await Promise.all([first, second])

    expect(pulls()).toBe(1)
  })

  it('reports progress to a caller that joined a refresh already running', async () => {
    const slowPull = deferred()
    vi.mocked(pullProducers).mockReturnValueOnce(slowPull.promise)
    const first = syncNow()
    const progress = vi.fn()
    const joined = syncNow(progress)
    slowPull.resolve()
    await Promise.all([first, joined])

    expect(progress).toHaveBeenCalled()
  })

  it('records the first completed pull, and not a failed one', async () => {
    vi.mocked(pullProducers).mockRejectedValueOnce(new Error('offline'))
    await expect(syncNow()).rejects.toThrow()
    expect(await db.meta.get('firstPullCompletedAt')).toBeUndefined()

    await syncNow()
    expect(await db.meta.get('firstPullCompletedAt')).toBeDefined()
  })

  it('does not record the first pull as complete while the pairings pull failed', async () => {
    vi.mocked(pullAllMealPairings).mockRejectedValueOnce(new Error('offline'))
    await syncNow()
    expect(await db.meta.get('firstPullCompletedAt')).toBeUndefined()
  })
})

describe('refreshInBackground', () => {
  it.each(['open', 'foreground'] as const)('%s runs a refresh, then at most one a minute across both triggers', async (trigger) => {
    await refreshInBackground(trigger)
    expect(pulls()).toBe(1)

    const other = trigger === 'open' ? 'foreground' : 'open'
    advance(MINUTE - 1)
    await refreshInBackground(trigger)
    await refreshInBackground(other)
    expect(pulls()).toBe(1)

    advance(1)
    await refreshInBackground(other)
    expect(pulls()).toBe(2)
  })

  it('is skipped without a network, and does not use up the minute', async () => {
    setOnline(false)
    await refreshInBackground('open')
    expect(pulls()).toBe(0)

    setOnline(true)
    await refreshInBackground('open')
    expect(pulls()).toBe(1)
  })

  it('swallows a failed refresh', async () => {
    vi.mocked(pullProducers).mockRejectedValueOnce(new Error('server down'))
    await expect(refreshInBackground('open')).resolves.toBeUndefined()
  })
})

describe('startSync', () => {
  let stop: () => void
  afterEach(() => stop())

  function setVisibility(state: 'visible' | 'hidden') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('refreshes at app start whatever happened a moment ago', async () => {
    await refreshInBackground('open')
    stop = startSync()
    await vi.waitFor(() => expect(pulls()).toBe(2))
  })

  it('does not refresh at start without a network', async () => {
    setOnline(false)
    stop = startSync()
    await new Promise((r) => setTimeout(r, 20))
    expect(pulls()).toBe(0)
  })

  it('refreshes on reconnect even inside the minute', async () => {
    setOnline(false)
    stop = startSync()
    await refreshInBackground('open')
    setOnline(true)
    await refreshInBackground('open')
    expect(pulls()).toBe(1)

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(pulls()).toBe(2))
  })

  it('refreshes when the app returns to the foreground, throttled with the list opening', async () => {
    stop = startSync()
    await vi.waitFor(() => expect(pulls()).toBe(1))

    advance(MINUTE)
    setVisibility('hidden')
    await new Promise((r) => setTimeout(r, 20))
    expect(pulls()).toBe(1)

    setVisibility('visible')
    await vi.waitFor(() => expect(pulls()).toBe(2))
    setVisibility('visible')
    await refreshInBackground('open')
    expect(pulls()).toBe(2)
  })

  it('stops listening once stopped', async () => {
    setOnline(false)
    stop = startSync()
    stop()
    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await new Promise((r) => setTimeout(r, 20))
    expect(pulls()).toBe(0)
    stop = () => {}
  })
})
