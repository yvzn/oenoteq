let seq = 0

// Offline-created records get a negative, client-only id until their create
// syncs and the local record is replaced by the server-assigned one. Shared
// across entities so two different entities can never mint the same id —
// `idRemap` is keyed by localId alone, with no entity discriminator.
export function nextLocalId(): number {
  seq += 1
  return -(Date.now() * 1000 + seq)
}
