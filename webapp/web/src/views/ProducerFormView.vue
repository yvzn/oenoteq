<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import SyncPendingBadge from '../components/SyncPendingBadge.vue'
import { useProducers } from '../composables/useProducers'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { validateName } from '../domain/nameForm'
import type { MessageRef } from '../i18n/messageRef'

const route = useRoute()
const { t } = useI18n()
const router = useRouter()

const editId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => editId.value !== null)

const {
  producers,
  loading: producersLoading,
  error: producersError,
  load: loadProducers,
  create: createProducer,
  update: updateProducer,
  creating,
  createError,
  updating,
  updateError,
} = useProducers()

const name = ref('')
const nameError = ref<MessageRef | null>(null)

const loading = computed(() => isEdit.value && producersLoading.value)
const loadError = computed(() => producersError.value)
const hasLoadError = computed(() => isEdit.value && loadError.value !== null)
const submitting = computed(() => creating.value || updating.value)
const submitError = computed(() => createError.value ?? updateError.value)

// Producer has no GET-by-id route (mirrors the ListProducers-only shape on
// the backend), so the edit form prefills from the already-loaded list.
watch(
  producers,
  (next) => {
    if (editId.value === null) return
    const existing = next.find((p) => p.id === editId.value)
    if (existing) name.value = existing.name
  },
  { immediate: true },
)

function retry() {
  if (isEdit.value) loadProducers()
}

onMounted(retry)

const formSuccess = useSuccessMessage()

function cancel() {
  router.push({ name: 'producers' })
}

async function submit() {
  const trimmed = name.value.trim()
  const invalid = validateName(trimmed)
  nameError.value = invalid ?? null
  if (invalid) return

  const saved = isEdit.value
    ? await updateProducer(editId.value as number, trimmed)
    : await createProducer(trimmed)

  if (saved) {
    formSuccess.showAndNavigate(
      isEdit.value ? t('manage.producers.form.updated') : t('manage.producers.form.added'),
      { name: 'producers' },
      router,
    )
  }
}
</script>

<template>
  <section class="px-6 py-6 sm:px-8 sm:py-10">
   <div class="mx-auto max-w-2xl">
    <PageHeader :title="isEdit ? t('manage.producers.form.renameTitle') : t('manage.producers.form.addTitle')" />
    <SyncPendingBadge v-if="isEdit" entity="producer" :target-id="editId as number" class="mt-3" />

    <StatusLine v-if="loading" class="mt-4">{{ t('manage.common.loading') }}</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      {{ t('manage.common.formLoadError', { error: loadError }) }}
      <template #retry>
        <AppButton variant="ghost" data-testid="producer-form-retry" @click="retry">{{ t('actions.retry') }}</AppButton>
      </template>
    </StatusLine>
    <form
      v-else
      data-testid="producer-form"
      class="mt-6 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <FormField :label="t('manage.common.name')" :error="nameError ? t(nameError.key, nameError.params ?? {}) : null" error-testid="producer-name-error">
        <input v-model="name" data-testid="producer-name-input" type="text" class="w-full" />
      </FormField>

      <StatusLine v-if="submitError" tone="error">{{ submitError }}</StatusLine>

      <div class="flex justify-between">
        <AppButton
          type="button"
          variant="ghost"
          data-testid="producer-form-cancel"
          :disabled="submitting"
          @click="cancel"
        >
          {{ t('actions.cancel') }}
        </AppButton>
        <AppButton
          type="submit"
          data-testid="producer-form-submit"
          :disabled="submitting"
        >
          {{ isEdit ? t('manage.common.saveChanges') : t('manage.producers.add') }}
        </AppButton>
      </div>
    </form>
   </div>
  </section>
</template>
