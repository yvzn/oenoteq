import { db } from '../db/localDb'
import { syncNow } from '../sync'
import { deleteLocalData, localStoreExists } from './deleteLocalData'
import { refuseConsent } from './grantConsent'
import { reloadInto } from './reload'

// How many unsent changes withdrawing would lose. Tries to sync first when online, so
// the answer is usually 0; a failed sync just leaves its changes counted. Looks at the
// store only if one exists (an existing install, or a user who granted just now), and
// never creates one.
export async function countUnsentChanges(): Promise<number> {
  if (!(await localStoreExists())) return 0
  if (navigator.onLine !== false) {
    try {
      await syncNow()
    } catch {
      // Whatever could not be sent stays in the outbox and is counted below.
    }
  }
  return db.outbox.count()
}

// Deletes the local data, records the refusal, then reloads into online-only mode.
// Callers confirm any unsent changes with the user first.
export async function withdrawConsent(destination: string): Promise<void> {
  await deleteLocalData()
  refuseConsent()
  reloadInto(destination)
}
