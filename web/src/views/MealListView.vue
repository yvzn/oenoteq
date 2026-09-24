<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Meal } from '../api/types'
import AppButton from '../components/AppButton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useMeals } from '../composables/useMeals'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { meals, loading, error, load, remove, deleting, deleteError } = useMeals()

const hasError = computed(() => error.value !== null)

const pendingDelete = ref<Meal | null>(null)
const confirmOpen = computed(() => pendingDelete.value !== null)
const confirmMessage = computed(() =>
  pendingDelete.value ? `Delete meal "${pendingDelete.value.name}"?` : '',
)

const listSuccess = useSuccessMessage()

function retry() {
  load()
}

onMounted(retry)

function askDelete(meal: Meal) {
  pendingDelete.value = meal
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
      <PageHeader title="Meals">
        <template #actions>
          <AppButton :to="{ name: 'meal-new' }" data-testid="add-meal-link">Add meal</AppButton>
        </template>
      </PageHeader>

      <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
      <StatusLine v-else-if="hasError" tone="error" class="mt-4">
        Couldn't load meals: {{ error }}
        <template #retry>
          <AppButton variant="ghost" data-testid="meal-list-retry" @click="retry">Retry</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="meals.length === 0" class="mt-4">No meals yet.</StatusLine>
      <ul v-else data-testid="meal-list" class="mt-4 flex flex-col">
        <li
          v-for="meal in meals"
          :key="meal.id"
          data-testid="meal-item"
          class="border-line flex items-center justify-between gap-3 border-b py-3"
        >
          <span data-testid="meal-name" class="text-ink text-sm">{{ meal.name }}</span>
          <div class="flex items-center gap-3">
            <AppButton
              variant="ghost"
              :to="{ name: 'meal-edit', params: { id: meal.id } }"
              data-testid="meal-rename-link"
            >
              Rename
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              data-testid="meal-delete-button"
              :disabled="deleting"
              @click="askDelete(meal)"
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
