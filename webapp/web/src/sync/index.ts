import { FIRST_PULL_KEY, db } from '../db/localDb'
import { refreshState } from './refreshState'
import { pullAppellations, pushAppellations } from './appellationSync'
import { pushConsumptions } from './consumptionSync'
import { pullAllMealPairings, pushMealPairings } from './mealPairingSync'
import { pullMeals, pushMeals } from './mealSync'
import { pullProducers, pushProducers } from './producerSync'
import { pullWines, pushWines } from './wineSync'

// Producer/Appellation/Meal creates first: a queued Wine or Meal Pairing
// referencing one created offline can't resolve its real id until that
// create has synced. Wine before Consumption for the same reason.
async function pushAll(): Promise<void> {
  await pushProducers()
  await pushAppellations()
  await pushMeals()
  await pushWines()
  await pushConsumptions()
  await pushMealPairings()
}

// Every push in flight, wherever it was started from, so a refresh never
// starts pulling while one is still sending (a pull could otherwise land
// between a send and the local write that confirms it).
const pushes = new Set<Promise<void>>()

function trackedPush(): Promise<void> {
  const push = pushAll()
  pushes.add(push)
  const done = () => void pushes.delete(push)
  push.then(done, done)
  return push
}

async function pushesSettled(): Promise<void> {
  while (pushes.size > 0) await Promise.allSettled([...pushes])
}

// Reports (done, total) after each step so a first download can show progress.
export type SyncProgress = (done: number, total: number) => void

async function pushThenSettle(): Promise<void> {
  await trackedPush()
  await pushesSettled()
}

async function syncAll(report: SyncProgress): Promise<void> {
  let pairingsPulled = true
  const steps = [
    pushThenSettle,
    pullProducers,
    pullAppellations,
    pullMeals,
    pullWines,
    // Isolated: a failed pairings pull must not fail the rest of the sync,
    // but the download is not complete without it (the meal filter needs it).
    () =>
      pullAllMealPairings().catch(() => {
        pairingsPulled = false
      }),
  ]
  for (const [index, step] of steps.entries()) {
    await step()
    report(index + 1, steps.length)
  }
  // Keeps the first completion: only "has it ever finished" matters.
  if (pairingsPulled && !(await db.meta.get(FIRST_PULL_KEY))) {
    await db.meta.put({ key: FIRST_PULL_KEY, value: new Date().toISOString() })
  }
}

// What asked for the refresh. `open` and `foreground` are throttled together;
// the others always run (unless one is already running).
export type RefreshTrigger = 'start' | 'reconnect' | 'manual' | 'open' | 'foreground'

const THROTTLED: ReadonlySet<RefreshTrigger> = new Set(['open', 'foreground'])
const THROTTLE_MS = 60_000

let inFlight: Promise<void> | null = null
let lastRunAt = Number.NEGATIVE_INFINITY
const progressListeners = new Set<SyncProgress>()

function startRefresh(): Promise<void> {
  lastRunAt = Date.now()
  refreshState.inFlight = true
  const run = syncAll((done, total) => progressListeners.forEach((listener) => listener(done, total)))
    .finally(() => {
      refreshState.inFlight = false
      inFlight = null
    })
  inFlight = run
  return run
}

// The one refresh routine: push the outbox, then pull, never two at once (a
// request while one runs joins it and hears its progress). Rejects if a push
// or entity pull fails (the meal-pairings pull is isolated and never rejects).
function refresh(trigger: RefreshTrigger, onProgress?: SyncProgress): Promise<void> {
  if (onProgress) progressListeners.add(onProgress)
  let run: Promise<void>
  if (inFlight) {
    run = inFlight
  } else if (trigger !== 'manual' && navigator.onLine === false) {
    return Promise.resolve()
  } else if (THROTTLED.has(trigger) && Date.now() - lastRunAt < THROTTLE_MS) {
    return Promise.resolve()
  } else {
    run = startRefresh()
  }
  if (!onProgress) return run
  const forget = () => void progressListeners.delete(onProgress)
  run.then(forget, forget)
  return run
}

// Awaitable full push + pull, for an explicit user-triggered "Retry sync" and
// for the first download after consent. Failed outbox items are not replayed
// here, same as the reconnect path.
export function syncNow(onProgress?: SyncProgress): Promise<void> {
  return refresh('manual', onProgress)
}

// Quiet refresh for the cellar list opening and the app returning to the
// foreground: a failure changes nothing visible, so it is swallowed.
export function refreshInBackground(trigger: 'open' | 'foreground'): Promise<void> {
  return refresh(trigger).catch(() => {})
}

// Fire-and-forget replay of every queued mutation, triggered right after a
// local write so a queued change syncs without waiting for the next
// reconnect if the network is actually still up. Two local writes in quick
// succession (e.g. creating a Meal then immediately pairing it) can each
// trigger their own overlapping call here — `replay()` claims an item
// before handling it so the two scans can't both pick up the same one.
export function pushChangesInBackground(): void {
  if (navigator.onLine === false) return
  trackedPush().catch(() => {})
}

// Refreshes the local store at app start, whenever the app regains
// connectivity and whenever it returns to the foreground, so the cellar
// stays current without user action. Returns what stops listening.
export function startSync(): () => void {
  const onReconnect = () => void refresh('reconnect').catch(() => {})
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void refreshInBackground('foreground')
  }
  window.addEventListener('online', onReconnect)
  document.addEventListener('visibilitychange', onVisibility)
  if (navigator.onLine) void refresh('start').catch(() => {})
  return () => {
    window.removeEventListener('online', onReconnect)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
