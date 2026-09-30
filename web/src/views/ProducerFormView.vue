<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useProducers } from '../composables/useProducers'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const route = useRoute()
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
const nameError = ref<string | null>(null)

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
  if (trimmed === '') {
    nameError.value = 'Name is required'
    return
  }
  nameError.value = null

  const saved = isEdit.value
    ? await updateProducer(editId.value as number, trimmed)
    : await createProducer(trimmed)

  if (saved) {
    formSuccess.showAndNavigate(
      isEdit.value ? 'Producer updated.' : 'Producer added.',
      { name: 'producers' },
      router,
    )
  }
}
</script>

<template>
  <section class="px-6 py-6">
   <div class="mx-auto max-w-2xl">
    <PageHeader :title="isEdit ? 'Rename producer' : 'Add producer'" />

    <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      Couldn't load: {{ loadError }}
      <template #retry>
        <AppButton variant="ghost" data-testid="producer-form-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <form
      v-else
      data-testid="producer-form"
      class="mt-6 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <FormField label="Name" :error="nameError" error-testid="producer-name-error">
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
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          data-testid="producer-form-submit"
          :disabled="submitting"
        >
          {{ isEdit ? 'Save changes' : 'Add producer' }}
        </AppButton>
      </div>
    </form>
   </div>
  </section>
</template>
