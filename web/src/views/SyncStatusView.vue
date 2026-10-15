<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useConnectivity } from '../composables/useConnectivity'
import { entityDisplayName, useSyncStatus } from '../composables/useSyncStatus'

const {
  counts,
  failed,
  pendingItems,
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
const { t, locale } = useI18n()

onMounted(refresh)

// Summary counts stay the default; the per-item list is opt-in and not persisted.
const showDetails = ref(false)

function formatQueuedAt(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale.value)
}

// One dialog serves both flows: discarding a single failed item, or clearing
// the whole queue.
type Pending = { kind: 'discard'; id: number } | { kind: 'clear' } | null
const pending = ref<Pending>(null)
const confirmOpen = computed(() => pending.value !== null)
const confirmMessage = computed(() => {
  if (pending.value?.kind !== 'clear') return t('sync.confirmDiscard')
  const n = queuedCount.value
  return t('sync.confirmClear', { count: n }, n)
})
const confirmLabel = computed(() => (pending.value?.kind === 'clear' ? t('sync.clearQueue') : t('sync.discard')))

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
      <PageHeader :title="t('sync.title')" />

      <div class="mt-4 flex items-center gap-3">
        <AppButton
          type="button"
          variant="secondary"
          data-testid="sync-status-retry-all"
          :disabled="isSyncing || !isOnline"
          @click="syncAllNow"
        >
          {{ isSyncing ? t('sync.syncing') : t('sync.retryAll') }}
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          data-testid="sync-status-clear"
          :disabled="isSyncing || queuedCount === 0"
          @click="askClear"
        >
          {{ t('sync.clearQueue') }}
        </AppButton>
        <p v-if="!isOnline" data-testid="sync-status-offline-note" class="text-muted text-sm">
          {{ t('sync.offlineNote') }}
        </p>
      </div>

      <ul data-testid="sync-status-counts" class="mt-4 flex flex-col">
        <li
          v-for="label in entityLabels"
          :key="label"
          data-testid="sync-status-count"
          class="border-line flex items-center justify-between border-b py-2.5 text-sm"
        >
          <span class="text-ink">{{ entityDisplayName(label) }}</span>
          <span class="text-muted tabular-nums">{{ counts[label] }}</span>
        </li>
      </ul>

      <div class="mt-3">
        <AppButton
          type="button"
          variant="ghost"
          data-testid="sync-status-toggle-details"
          :aria-expanded="showDetails"
          @click="showDetails = !showDetails"
        >
          {{ showDetails ? t('sync.hideDetails') : t('sync.showDetails') }}
        </AppButton>
        <template v-if="showDetails">
          <StatusLine v-if="pendingItems.length === 0" data-testid="sync-status-nothing-pending">
            {{ t('sync.nothingPending') }}
          </StatusLine>
          <ul v-else data-testid="sync-status-pending-list" class="mt-2 flex flex-col">
            <li
              v-for="item in pendingItems"
              :key="item.id"
              data-testid="sync-status-pending-item"
              class="border-line border-b py-2.5 text-sm"
            >
              <p class="text-ink">{{ item.label }}</p>
              <p class="text-muted">
                <span data-testid="sync-status-pending-operation">{{ item.operation }}</span>
                <template v-if="item.queuedAt">
                  · <span data-testid="sync-status-pending-time">{{ formatQueuedAt(item.queuedAt) }}</span>
                </template>
              </p>
            </li>
          </ul>
        </template>
      </div>

      <section class="mt-8">
        <h2 class="font-display text-ink mb-3 text-[16px] font-semibold">{{ t('sync.failedTitle') }}</h2>
        <StatusLine v-if="failed.length === 0" data-testid="sync-status-no-failures">
          {{ t('sync.nothingFailed') }}
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
                {{ t('sync.retry') }}
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                data-testid="sync-status-discard"
                @click="askDiscard(item.id)"
              >
                {{ t('sync.discard') }}
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
