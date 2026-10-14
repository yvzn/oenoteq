<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useConnectivity } from '../composables/useConnectivity'
import { useSyncStatus } from '../composables/useSyncStatus'

const {
  counts,
  failed,
  entityLabels,
  isSyncing,
  queuedCount,
  refresh,
  syncAllNow,
  retryFailedItem,
  discardFailedItem,
  clearAllQueued,
} = useSyncStatus()
const { isOnline } = useConnectivity()

onMounted(refresh)

// One dialog serves both flows: discarding a single failed item, or clearing
// the whole queue.
type Pending = { kind: 'discard'; id: number } | { kind: 'clear' } | null
const pending = ref<Pending>(null)
const confirmOpen = computed(() => pending.value !== null)
const confirmMessage = computed(() => {
  if (pending.value?.kind !== 'clear') return "Discard this queued change? It won't be retried."
  const n = queuedCount.value
  return `Clear the queue? ${n} queued ${n === 1 ? 'change' : 'changes'} will be lost. This can't be undone.`
})
const confirmLabel = computed(() => (pending.value?.kind === 'clear' ? 'Clear queue' : 'Discard'))

function askDiscard(id: number) {
  pending.value = { kind: 'discard', id }
}

function askClear() {
  pending.value = { kind: 'clear' }
}

function cancelConfirm() {
  pending.value = null
}

async function confirm() {
  const current = pending.value
  pending.value = null
  if (current?.kind === 'discard') await discardFailedItem(current.id)
  else if (current?.kind === 'clear') await clearAllQueued()
}
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader title="Sync status" />

      <div class="mt-4 flex items-center gap-3">
        <AppButton
          type="button"
          variant="secondary"
          data-testid="sync-status-retry-all"
          :disabled="isSyncing || !isOnline"
          @click="syncAllNow"
        >
          {{ isSyncing ? 'Syncing…' : 'Retry sync' }}
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          data-testid="sync-status-clear"
          :disabled="isSyncing || queuedCount === 0"
          @click="askClear"
        >
          Clear queue
        </AppButton>
        <p v-if="!isOnline" data-testid="sync-status-offline-note" class="text-muted text-sm">
          You're offline. Sync will run when you're back online.
        </p>
      </div>

      <ul data-testid="sync-status-counts" class="mt-4 flex flex-col">
        <li
          v-for="label in entityLabels"
          :key="label"
          data-testid="sync-status-count"
          class="border-line flex items-center justify-between border-b py-2.5 text-sm"
        >
          <span class="text-ink">{{ label }}</span>
          <span class="text-muted tabular-nums">{{ counts[label] }}</span>
        </li>
      </ul>

      <section class="mt-8">
        <h2 class="font-display text-ink mb-3 text-[16px] font-semibold">Failed items</h2>
        <StatusLine v-if="failed.length === 0" data-testid="sync-status-no-failures">
          Nothing failed.
        </StatusLine>
        <ul v-else data-testid="sync-status-failed-list" class="flex flex-col gap-3">
          <li
            v-for="item in failed"
            :key="item.id"
            data-testid="sync-status-failed-item"
            class="border-line rounded-lg border p-3"
          >
            <p class="text-ink text-sm font-semibold">{{ item.label }}</p>
            <p data-testid="sync-status-failed-reason" class="text-danger mt-1 text-sm">{{ item.reason }}</p>
            <div class="mt-2 flex gap-4">
              <AppButton
                type="button"
                variant="ghost"
                data-testid="sync-status-retry"
                @click="retryFailedItem(item.id)"
              >
                Retry
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                data-testid="sync-status-discard"
                @click="askDiscard(item.id)"
              >
                Discard
              </AppButton>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      @confirm="confirm"
      @cancel="cancelConfirm"
    />
  </section>
</template>
