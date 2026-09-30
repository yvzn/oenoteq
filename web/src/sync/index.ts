import { pullAppellations, pushAppellations } from './appellationSync'
import { pushConsumptions } from './consumptionSync'
import { pushMealPairings } from './mealPairingSync'
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

async function syncAll(): Promise<void> {
  await pushAll()
  await pullProducers()
  await pullAppellations()
  await pullMeals()
  await pullWines()
}

// Fire-and-forget replay of every queued mutation, triggered right after a
// local write so a queued change syncs without waiting for the next
// reconnect if the network is actually still up. Two local writes in quick
// succession (e.g. creating a Meal then immediately pairing it) can each
// trigger their own overlapping call here — `replay()` claims an item
// before handling it so the two scans can't both pick up the same one.
export function pushChangesInBackground(): void {
  if (navigator.onLine === false) return
  pushAll().catch(() => {})
}

// Replays queued writes and refreshes the local store whenever the app
// regains connectivity, so a queued change syncs without user action.
export function startSync(): void {
  window.addEventListener('online', () => {
    syncAll().catch(() => {})
  })
  if (navigator.onLine) syncAll().catch(() => {})
}
