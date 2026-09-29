import { pullWines, pushWines } from './wineSync'

async function syncWines(): Promise<void> {
  await pushWines()
  await pullWines()
}

// Replays queued writes and refreshes the local store whenever the app
// regains connectivity, so a queued change syncs without user action.
export function startSync(): void {
  window.addEventListener('online', () => {
    syncWines().catch(() => {})
  })
  if (navigator.onLine) syncWines().catch(() => {})
}
