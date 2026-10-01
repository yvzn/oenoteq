<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Color } from '../api/types'
import AppButton from '../components/AppButton.vue'
import AutocompleteField from '../components/AutocompleteField.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import CreateFeedback from '../components/CreateFeedback.vue'
import FormField from '../components/FormField.vue'
import NumberStepper from '../components/NumberStepper.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useProducers } from '../composables/useProducers'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { useWines } from '../composables/useWines'
import {
  deriveGardeFin,
  emptyWineFormFields,
  toWineCreateInput,
  toWineInput,
  validateInitialQuantity,
  validateWineForm,
  wineToFormFields,
  type WineFormErrors,
  type WineFormFields,
} from '../domain/wineForm'

const route = useRoute()
const router = useRouter()

const editId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => editId.value !== null)

const {
  wine,
  loading: wineLoading,
  error: wineError,
  load: loadWine,
  create: createWine,
  update: updateWine,
  submitting,
  submitError,
} = useWines()

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
  create: createAppellation,
  creating: creatingAppellation,
  createError: appellationCreateError,
} = useAppellations()

const {
  producers,
  loading: producersLoading,
  error: producersError,
  load: loadProducers,
  create: createProducer,
  creating: creatingProducer,
  createError: producerCreateError,
} = useProducers()

const colors: Color[] = ['rouge', 'blanc', 'rose']

const millesime = ref(emptyWineFormFields.millesime)
const appellationId = ref<number | null>(emptyWineFormFields.appellationId)
const producerId = ref<number | null>(emptyWineFormFields.producerId)
const color = ref<Color | ''>(emptyWineFormFields.color)
const gardeDebut = ref(emptyWineFormFields.gardeDebut)
const gardeFin = ref(emptyWineFormFields.gardeFin)
const quantity = ref(emptyWineFormFields.quantity)

const fields = computed<WineFormFields>(() => ({
  millesime: millesime.value,
  appellationId: appellationId.value,
  producerId: producerId.value,
  color: color.value,
  gardeDebut: gardeDebut.value,
  gardeFin: gardeFin.value,
  quantity: quantity.value,
}))

const errors = ref<WineFormErrors>({})

function fillGardeFin() {
  gardeFin.value = deriveGardeFin(gardeDebut.value, gardeFin.value)
}

const loading = computed(
  () => appellationsLoading.value || producersLoading.value || (isEdit.value && wineLoading.value),
)
const loadError = computed(() =>
  [appellationsError.value, producersError.value, isEdit.value ? wineError.value : null]
    .filter((e): e is string => e !== null)
    .join('; '),
)
const hasLoadError = computed(() => loadError.value !== '')

watch(
  wine,
  (next) => {
    if (!next) return
    const prefilled = wineToFormFields(next)
    millesime.value = prefilled.millesime
    appellationId.value = prefilled.appellationId
    producerId.value = prefilled.producerId
    color.value = prefilled.color
    gardeDebut.value = prefilled.gardeDebut
    gardeFin.value = prefilled.gardeFin
    quantity.value = prefilled.quantity
  },
  { immediate: true },
)

function retry() {
  loadAppellations()
  loadProducers()
  if (editId.value !== null) {
    const requestedId = editId.value
    loadWine(requestedId).then((resolvedId) => {
      // A not-yet-synced local id has since synced to a real one — fix up
      // the address bar (the form itself already loaded/prefilled correctly
      // via load()'s own remap resolution).
      if (resolvedId !== requestedId && editId.value === requestedId) {
        router.replace({ name: 'wine-edit', params: { id: resolvedId } })
      }
    })
  }
}

onMounted(retry)

interface CreatedEntity {
  id: number
  name: string
}

const createdAppellation = ref<CreatedEntity | null>(null)
const createdProducer = ref<CreatedEntity | null>(null)

// The confirmation only describes the entity that is still selected, and a
// "required" error no longer applies once a value is chosen (picked or created).
watch(appellationId, (id) => {
  if (createdAppellation.value && createdAppellation.value.id !== id) createdAppellation.value = null
  if (id !== null) delete errors.value.appellationId
})
watch(producerId, (id) => {
  if (createdProducer.value && createdProducer.value.id !== id) createdProducer.value = null
  if (id !== null) delete errors.value.producerId
})

async function submitNewAppellation(name: string) {
  createdAppellation.value = null
  const created = await createAppellation(name)
  if (!created) return
  appellationId.value = created.id
  createdAppellation.value = { id: created.id, name: created.name }
}

async function submitNewProducer(name: string) {
  createdProducer.value = null
  const created = await createProducer(name)
  if (!created) return
  producerId.value = created.id
  createdProducer.value = { id: created.id, name: created.name }
}

const formSuccess = useSuccessMessage()

function cancel() {
  router.push(isEdit.value ? { name: 'wine-detail', params: { id: editId.value } } : { name: 'cellar' })
}

async function submit() {
  const validationErrors = validateWineForm(fields.value)
  if (!isEdit.value) {
    const quantityError = validateInitialQuantity(quantity.value)
    if (quantityError) validationErrors.quantity = quantityError
  }
  errors.value = validationErrors
  if (Object.keys(validationErrors).length > 0) return

  const saved = isEdit.value
    ? await updateWine(editId.value as number, toWineInput(fields.value))
    : await createWine(toWineCreateInput(fields.value))

  if (saved) {
    formSuccess.showAndNavigate(
      isEdit.value ? 'Wine updated.' : 'Wine added.',
      { name: 'wine-detail', params: { id: saved.id } },
      router,
    )
  }
}
</script>

<template>
  <section class="px-6 py-6">
   <div class="mx-auto max-w-2xl">
    <PageHeader :title="isEdit ? 'Edit wine' : 'Add wine'" :color="color" />

    <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      Couldn't load: {{ loadError }}
      <template #retry>
        <AppButton variant="ghost" data-testid="wine-form-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <form
      v-else
      data-testid="wine-form"
      class="mt-6 flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <div class="grid grid-cols-2 gap-4">
        <FormField label="Millesime" :error="errors.millesime">
          <input v-model="millesime" data-testid="wine-millesime-input" type="number" class="w-full" />
        </FormField>

        <FormField label="Color" :error="errors.color" error-testid="wine-color-error">
          <div class="flex items-center gap-2">
            <ColorSwatch v-if="color" :color="color" class="shrink-0" />
            <select v-model="color" data-testid="wine-color-input" class="w-full">
              <option value="">Choose a color</option>
              <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </FormField>
      </div>

      <FormField label="Appellation" :error="errors.appellationId" error-testid="wine-appellation-error">
        <AutocompleteField
          testid="wine-appellation"
          :items="appellations"
          :model-value="appellationId"
          placeholder="Pick or create an appellation"
          creatable
          :busy="creatingAppellation"
          @update:model-value="(v) => (appellationId = v)"
          @create="submitNewAppellation"
        />
        <CreateFeedback
          testid="new-appellation"
          entity="appellation"
          :creating="creatingAppellation"
          :created="createdAppellation"
          :error="appellationCreateError"
        />
      </FormField>

      <FormField label="Producer" :error="errors.producerId" error-testid="wine-producer-error">
        <AutocompleteField
          testid="wine-producer"
          :items="producers"
          :model-value="producerId"
          placeholder="Pick or create a producer"
          creatable
          :busy="creatingProducer"
          @update:model-value="(v) => (producerId = v)"
          @create="submitNewProducer"
        />
        <CreateFeedback
          testid="new-producer"
          entity="producer"
          :creating="creatingProducer"
          :created="createdProducer"
          :error="producerCreateError"
        />
      </FormField>

      <div class="grid grid-cols-2 gap-4">
        <FormField label="Garde start" :error="errors.gardeDebut" error-testid="wine-garde-debut-error">
          <input
            v-model="gardeDebut"
            data-testid="wine-garde-debut-input"
            type="number"
            class="w-full"
            @blur="fillGardeFin"
          />
        </FormField>

        <FormField label="Garde end" :error="errors.gardeFin" error-testid="wine-garde-fin-error">
          <input v-model="gardeFin" data-testid="wine-garde-fin-input" type="number" class="w-full" />
        </FormField>
      </div>

      <FormField
        v-if="!isEdit"
        label="Initial quantity"
        :error="errors.quantity"
        error-testid="wine-quantity-error"
      >
        <NumberStepper
          v-model="quantity"
          :min="1"
          input-testid="wine-quantity-input"
          decrement-testid="wine-quantity-decrement"
          increment-testid="wine-quantity-increment"
        />
      </FormField>

      <StatusLine v-if="submitError" tone="error">{{ submitError }}</StatusLine>

      <div class="flex justify-between">
        <AppButton
          type="button"
          variant="ghost"
          data-testid="wine-form-cancel"
          :disabled="submitting"
          @click="cancel"
        >
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          data-testid="wine-form-submit"
          :disabled="submitting"
        >
          {{ isEdit ? 'Save changes' : 'Add wine' }}
        </AppButton>
      </div>
    </form>
   </div>
  </section>
</template>
