<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useSyncStatus } from '../composables/useSyncStatus'

const { counts, failed, entityLabels, refresh, retryFailedItem, discardFailedItem } = useSyncStatus()

onMounted(refresh)

const pendingDiscardId = ref<number | null>(null)
const confirmOpen = computed(() => pendingDiscardId.value !== null)

function askDiscard(id: number) {
  pendingDiscardId.value = id
}

function cancelDiscard() {
  pendingDiscardId.value = null
}

async function confirmDiscard() {
  if (pendingDiscardId.value === null) return
  const id = pendingDiscardId.value
  pendingDiscardId.value = null
  await discardFailedItem(id)
}
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader title="Sync status" />

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
      message="Discard this queued change? It won't be retried."
      confirm-label="Discard"
      @confirm="confirmDiscard"
      @cancel="cancelDiscard"
    />
  </section>
</template>
