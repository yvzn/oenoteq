import { liveQuery } from 'dexie'
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { isOfflineMode } from '../consent/storageConsent'
import { FIRST_PULL_KEY, db } from '../db/localDb'
import { refreshInBackground } from '../sync'
import { refreshState } from '../sync/refreshState'

// Keeps the cellar list fresh in Offline Mode (ADR 0009): a quiet refresh when
// the list opens, and a read of whether anything was ever downloaded, so an
// empty store is not mistaken for an empty cellar. Online-only mode has no
// local store, so none of this runs and the list is never "not downloaded".
export function useCellarRefresh() {
  const offlineMode = isOfflineMode()
  // Nothing downloaded yet and nothing created locally either. Assumed false
  // until the store has been read, so the message never flashes up.
  const neverDownloaded = ref(false)
  let subscription: { unsubscribe(): void } | null = null

  onMounted(() => {
    if (!offlineMode) return
    subscription = liveQuery(
      async () => !(await db.meta.get(FIRST_PULL_KEY)) && (await db.wines.count()) === 0,
    ).subscribe({ next: (value) => (neverDownloaded.value = value), error: () => {} })
    void refreshInBackground('open')
  })

  onScopeDispose(() => subscription?.unsubscribe())

  // The very first download is under way: say so rather than show a verdict.
  const downloading = computed(() => neverDownloaded.value && refreshState.inFlight)
  // The first download has not happened and is not happening (no network, or it failed).
  const needsConnectedVisit = computed(() => neverDownloaded.value && !refreshState.inFlight)

  return { downloading, needsConnectedVisit, neverDownloaded }
}
