import { db } from './db/localDb'

// Called when a new service worker is installed and waiting. Applying it
// reloads the page, which would strand a queued change mid-flush, so the
// update is held back while the outbox has any pending or failed item. It is
// never applied mid-session once deferred: the browser re-reports the
// waiting worker on the next app open, and this runs again then. (The
// browser may still activate a waiting worker once every tab is closed, but
// that never forces a reload and queued items persist in IndexedDB.)
export async function handleNeedRefresh(apply: () => void): Promise<void> {
  if ((await db.outbox.count()) > 0) return
  apply()
}
