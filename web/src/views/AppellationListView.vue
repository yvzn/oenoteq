<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Appellation } from '../api/types'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { appellations, loading, error, load, remove, deleting, deleteError } = useAppellations()

const hasError = computed(() => error.value !== null)

const pendingDelete = ref<Appellation | null>(null)
const confirmOpen = computed(() => pendingDelete.value !== null)
const confirmMessage = computed(() =>
  pendingDelete.value ? `Delete appellation "${pendingDelete.value.name}"?` : '',
)

const listSuccess = useSuccessMessage()

function retry() {
  load()
}

onMounted(retry)

function askDelete(appellation: Appellation) {
  pendingDelete.value = appellation
}

function cancelDelete() {
  pendingDelete.value = null
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  const { id, name } = pendingDelete.value
  pendingDelete.value = null
  const removed = await remove(id)
  if (removed) listSuccess.show(`Deleted "${name}".`)
}
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader title="Appellations">
        <template #actions>
          <AppButton :to="{ name: 'appellation-new' }" data-testid="add-appellation-link">
            Add appellation
          </AppButton>
        </template>
      </PageHeader>

      <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
      <StatusLine v-else-if="hasError" tone="error" class="mt-4">
        Couldn't load appellations: {{ error }}
        <template #retry>
          <AppButton variant="ghost" data-testid="appellation-list-retry" @click="retry">Retry</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="appellations.length === 0" class="mt-4">No appellations yet.</StatusLine>
      <ul v-else data-testid="appellation-list" class="mt-4 flex flex-col">
        <li
          v-for="appellation in appellations"
          :key="appellation.id"
          data-testid="appellation-item"
          class="border-line flex items-center justify-between gap-3 border-b py-3"
        >
          <span data-testid="appellation-name" class="text-ink text-sm">{{ appellation.name }}</span>
          <div class="flex items-center gap-3">
            <AppButton
              variant="ghost"
              :to="{ name: 'appellation-edit', params: { id: appellation.id } }"
              data-testid="appellation-rename-link"
            >
              Rename
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              data-testid="appellation-delete-button"
              :disabled="deleting"
              @click="askDelete(appellation)"
            >
              Delete
            </AppButton>
          </div>
        </li>
      </ul>

      <StatusLine v-if="deleteError" tone="error" class="mt-3">{{ deleteError }}</StatusLine>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :message="confirmMessage"
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>
