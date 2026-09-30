import { db } from '../db/localDb'
import { RetryableOutboxError } from './outbox'

// A negative id is local-only. If it's still in the local store, its create
// hasn't synced yet and it can never exist at the server. If it's gone, its
// create may have already synced and replaced it — check the breadcrumb
// (`idRemap`) left behind by that push. Missing breadcrumb means that create
// itself hasn't synced yet either, which is just as transient as a network
// error, so it's retried the same way rather than failed permanently.
export async function resolveSyncedId(id: number): Promise<number> {
  if (id >= 0) return id
  const remap = await db.idRemap.get(id)
  if (!remap) throw new RetryableOutboxError("This hasn't synced yet")
  return remap.serverId
}
