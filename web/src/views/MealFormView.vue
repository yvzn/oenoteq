<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useMeals } from '../composables/useMeals'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const route = useRoute()
const router = useRouter()

const editId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => editId.value !== null)

const {
  meals,
  loading: mealsLoading,
  error: mealsError,
  load: loadMeals,
  create: createMeal,
  update: updateMeal,
  creating,
  createError,
  updating,
  updateError,
} = useMeals()

const name = ref('')
const nameError = ref<string | null>(null)

const loading = computed(() => isEdit.value && mealsLoading.value)
const loadError = computed(() => mealsError.value)
const hasLoadError = computed(() => isEdit.value && loadError.value !== null)
const submitting = computed(() => creating.value || updating.value)
const submitError = computed(() => createError.value ?? updateError.value)

// Meal has no GET-by-id route (mirrors the ListMeal-only shape on the
// backend), so the edit form prefills from the already-loaded list.
watch(
  meals,
  (next) => {
    if (editId.value === null) return
    const existing = next.find((m) => m.id === editId.value)
    if (existing) name.value = existing.name
  },
  { immediate: true },
)

function retry() {
  if (isEdit.value) loadMeals()
}

onMounted(retry)

const formSuccess = useSuccessMessage()

function cancel() {
  router.push({ name: 'meals' })
}

async function submit() {
  const trimmed = name.value.trim()
  if (trimmed === '') {
    nameError.value = 'Name is required'
    return
  }
  nameError.value = null

  const saved = isEdit.value
    ? await updateMeal(editId.value as number, trimmed)
    : await createMeal(trimmed)

  if (saved) {
    formSuccess.showAndNavigate(isEdit.value ? 'Meal updated.' : 'Meal added.', { name: 'meals' }, router)
  }
}
</script>

<template>
  <section class="px-6 py-6">
   <div class="mx-auto max-w-2xl">
    <PageHeader :title="isEdit ? 'Rename meal' : 'Add meal'" />

    <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      Couldn't load: {{ loadError }}
      <template #retry>
        <AppButton variant="ghost" data-testid="meal-form-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <form
      v-else
      data-testid="meal-form"
      class="mt-6 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <FormField label="Name" :error="nameError" error-testid="meal-name-error">
        <input v-model="name" data-testid="meal-name-input" type="text" class="w-full" />
      </FormField>

      <StatusLine v-if="submitError" tone="error">{{ submitError }}</StatusLine>

      <div class="flex justify-between">
        <AppButton
          type="button"
          variant="ghost"
          data-testid="meal-form-cancel"
          :disabled="submitting"
          @click="cancel"
        >
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          data-testid="meal-form-submit"
          :disabled="submitting"
        >
          {{ isEdit ? 'Save changes' : 'Add meal' }}
        </AppButton>
      </div>
    </form>
   </div>
  </section>
</template>
