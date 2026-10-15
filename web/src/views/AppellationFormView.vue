<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import SyncPendingBadge from '../components/SyncPendingBadge.vue'
import { useAppellations } from '../composables/useAppellations'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { validateName } from '../domain/nameForm'
import type { MessageRef } from '../i18n/messageRef'

const route = useRoute()
const { t } = useI18n()
const router = useRouter()

const editId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => editId.value !== null)

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
  create: createAppellation,
  update: updateAppellation,
  creating,
  createError,
  updating,
  updateError,
} = useAppellations()

const name = ref('')
const nameError = ref<MessageRef | null>(null)

const loading = computed(() => isEdit.value && appellationsLoading.value)
const loadError = computed(() => appellationsError.value)
const hasLoadError = computed(() => isEdit.value && loadError.value !== null)
const submitting = computed(() => creating.value || updating.value)
const submitError = computed(() => createError.value ?? updateError.value)

// Appellation has no GET-by-id route (mirrors the ListAppellations-only shape
// on the backend), so the edit form prefills from the already-loaded list.
watch(
  appellations,
  (next) => {
    if (editId.value === null) return
    const existing = next.find((a) => a.id === editId.value)
    if (existing) name.value = existing.name
  },
  { immediate: true },
)

function retry() {
  if (isEdit.value) loadAppellations()
}

onMounted(retry)

const formSuccess = useSuccessMessage()

function cancel() {
  router.push({ name: 'appellations' })
}

async function submit() {
  const trimmed = name.value.trim()
  const invalid = validateName(trimmed)
  nameError.value = invalid ?? null
  if (invalid) return

  const saved = isEdit.value
    ? await updateAppellation(editId.value as number, trimmed)
    : await createAppellation(trimmed)

  if (saved) {
    formSuccess.showAndNavigate(
      isEdit.value ? t('manage.appellations.form.updated') : t('manage.appellations.form.added'),
      { name: 'appellations' },
      router,
    )
  }
}
</script>

<template>
  <section class="px-6 py-6">
   <div class="mx-auto max-w-2xl">
    <PageHeader :title="isEdit ? t('manage.appellations.form.renameTitle') : t('manage.appellations.form.addTitle')" />
    <SyncPendingBadge v-if="isEdit" entity="appellation" :target-id="editId as number" class="mt-3" />

    <StatusLine v-if="loading" class="mt-4">{{ t('manage.common.loading') }}</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      {{ t('manage.common.formLoadError', { error: loadError }) }}
      <template #retry>
        <AppButton variant="ghost" data-testid="appellation-form-retry" @click="retry">{{ t('actions.retry') }}</AppButton>
      </template>
    </StatusLine>
    <form
      v-else
      data-testid="appellation-form"
      class="mt-6 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <FormField :label="t('manage.common.name')" :error="nameError ? t(nameError.key, nameError.params ?? {}) : null" error-testid="appellation-name-error">
        <input v-model="name" data-testid="appellation-name-input" type="text" class="w-full" />
      </FormField>

      <StatusLine v-if="submitError" tone="error">{{ submitError }}</StatusLine>

      <div class="flex justify-between">
        <AppButton
          type="button"
          variant="ghost"
          data-testid="appellation-form-cancel"
          :disabled="submitting"
          @click="cancel"
        >
          {{ t('actions.cancel') }}
        </AppButton>
        <AppButton
          type="submit"
          data-testid="appellation-form-submit"
          :disabled="submitting"
        >
          {{ isEdit ? t('manage.common.saveChanges') : t('manage.appellations.add') }}
        </AppButton>
      </div>
    </form>
   </div>
  </section>
</template>
