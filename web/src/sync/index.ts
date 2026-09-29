import { pushConsumptions } from './consumptionSync'
import { pullWines, pushWines } from './wineSync'

async function syncAll(): Promise<void> {
  // Wine creates first: a queued consumption or quantity adjustment against
  // a wine created offline can't resolve that wine's real id until its own
  // create has synced.
  await pushWines()
  await pushConsumptions()
  await pullWines()
}

// Replays queued writes and refreshes the local store whenever the app
// regains connectivity, so a queued change syncs without user action.
export function startSync(): void {
  window.addEventListener('online', () => {
    syncAll().catch(() => {})
  })
  if (navigator.onLine) syncAll().catch(() => {})
}
