<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Producer } from '../api/types'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useProducers } from '../composables/useProducers'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { producers, loading, error, load, remove, deleting, deleteError } = useProducers()

const hasError = computed(() => error.value !== null)

const pendingDelete = ref<Producer | null>(null)
const confirmOpen = computed(() => pendingDelete.value !== null)
const confirmMessage = computed(() =>
  pendingDelete.value ? `Delete producer "${pendingDelete.value.name}"?` : '',
)

const listSuccess = useSuccessMessage()

function retry() {
  load()
}

onMounted(retry)

function askDelete(producer: Producer) {
  pendingDelete.value = producer
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
      <PageHeader title="Producers">
        <template #actions>
          <AppButton :to="{ name: 'producer-new' }" data-testid="add-producer-link">
            Add producer
          </AppButton>
        </template>
      </PageHeader>

      <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
      <StatusLine v-else-if="hasError" tone="error" class="mt-4">
        Couldn't load producers: {{ error }}
        <template #retry>
          <AppButton variant="ghost" data-testid="producer-list-retry" @click="retry">Retry</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="producers.length === 0" class="mt-4">No producers yet.</StatusLine>
      <ul v-else data-testid="producer-list" class="mt-4 flex flex-col">
        <li
          v-for="producer in producers"
          :key="producer.id"
          data-testid="producer-item"
          class="border-line flex items-center justify-between gap-3 border-b py-3"
        >
          <span data-testid="producer-name" class="text-ink text-sm">{{ producer.name }}</span>
          <div class="flex items-center gap-3">
            <AppButton
              variant="ghost"
              :to="{ name: 'producer-edit', params: { id: producer.id } }"
              data-testid="producer-rename-link"
            >
              Rename
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              data-testid="producer-delete-button"
              :disabled="deleting"
              @click="askDelete(producer)"
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
