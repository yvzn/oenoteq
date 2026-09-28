<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Color } from '../api/types'
import AppButton from '../components/AppButton.vue'
import AutocompleteField from '../components/AutocompleteField.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useProducers } from '../composables/useProducers'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { useWines } from '../composables/useWines'
import {
  deriveGardeFin,
  emptyWineFormFields,
  toWineInput,
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

function stepQuantity(delta: number) {
  const next = Math.max(0, (Number(quantity.value) || 0) + delta)
  quantity.value = String(next)
}

const showNewAppellation = ref(false)
const newAppellationName = ref('')

const showNewProducer = ref(false)
const newProducerName = ref('')

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
  if (editId.value !== null) loadWine(editId.value)
}

onMounted(retry)

function toggleNewAppellation() {
  showNewAppellation.value = !showNewAppellation.value
  newAppellationName.value = ''
}

async function submitNewAppellation() {
  const name = newAppellationName.value.trim()
  if (name === '') return
  const created = await createAppellation(name)
  if (created) {
    appellationId.value = created.id
    showNewAppellation.value = false
    newAppellationName.value = ''
  }
}

function toggleNewProducer() {
  showNewProducer.value = !showNewProducer.value
  newProducerName.value = ''
}

async function submitNewProducer() {
  const name = newProducerName.value.trim()
  if (name === '') return
  const created = await createProducer(name)
  if (created) {
    producerId.value = created.id
    showNewProducer.value = false
    newProducerName.value = ''
  }
}

const formSuccess = useSuccessMessage()

async function submit() {
  const validationErrors = validateWineForm(fields.value)
  errors.value = validationErrors
  if (Object.keys(validationErrors).length > 0) return

  const input = toWineInput(fields.value)
  const saved = isEdit.value ? await updateWine(editId.value as number, input) : await createWine(input)

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
          placeholder="Pick an appellation"
          @update:model-value="(v) => (appellationId = v)"
        />
        <AppButton
          type="button"
          variant="ghost"
          data-testid="new-appellation-toggle"
          class="mt-1.5 self-start text-xs"
          @click="toggleNewAppellation"
        >
          {{ showNewAppellation ? 'Cancel' : "Can't find it? Create new appellation" }}
        </AppButton>
        <div v-if="showNewAppellation" class="mt-2 flex items-center gap-2">
          <input
            v-model="newAppellationName"
            data-testid="new-appellation-name-input"
            type="text"
            placeholder="New appellation name"
            class="min-w-0 flex-1 text-sm"
            @keydown.enter.prevent="submitNewAppellation"
          />
          <AppButton
            type="button"
            data-testid="new-appellation-submit"
            :disabled="creatingAppellation"
            class="text-xs"
            @click="submitNewAppellation"
          >
            Create
          </AppButton>
        </div>
        <p v-if="appellationCreateError" data-testid="new-appellation-error" class="text-danger text-xs">
          {{ appellationCreateError }}
        </p>
      </FormField>

      <FormField label="Producer" :error="errors.producerId" error-testid="wine-producer-error">
        <AutocompleteField
          testid="wine-producer"
          :items="producers"
          :model-value="producerId"
          placeholder="Pick a producer"
          @update:model-value="(v) => (producerId = v)"
        />
        <AppButton
          type="button"
          variant="ghost"
          data-testid="new-producer-toggle"
          class="mt-1.5 self-start text-xs"
          @click="toggleNewProducer"
        >
          {{ showNewProducer ? 'Cancel' : "Can't find it? Create new producer" }}
        </AppButton>
        <div v-if="showNewProducer" class="mt-2 flex items-center gap-2">
          <input
            v-model="newProducerName"
            data-testid="new-producer-name-input"
            type="text"
            placeholder="New producer name"
            class="min-w-0 flex-1 text-sm"
            @keydown.enter.prevent="submitNewProducer"
          />
          <AppButton
            type="button"
            data-testid="new-producer-submit"
            :disabled="creatingProducer"
            class="text-xs"
            @click="submitNewProducer"
          >
            Create
          </AppButton>
        </div>
        <p v-if="producerCreateError" data-testid="new-producer-error" class="text-danger text-xs">
          {{ producerCreateError }}
        </p>
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

      <FormField label="Quantity" :error="errors.quantity" error-testid="wine-quantity-error">
        <div class="border-line bg-parchment-raised inline-flex w-auto self-start items-stretch overflow-hidden rounded-lg border">
          <button
            type="button"
            class="text-ink-soft hover:bg-parchment focus-visible:ring-bordeaux w-10 cursor-pointer rounded-l-lg text-lg font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            @click="stepQuantity(-1)"
          >
            −
          </button>
          <input
            v-model="quantity"
            data-testid="wine-quantity-input"
            type="number"
            class="border-line w-16 rounded-none border-x bg-transparent text-center"
          />
          <button
            type="button"
            class="text-ink-soft hover:bg-parchment focus-visible:ring-bordeaux w-10 cursor-pointer rounded-r-lg text-lg font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            @click="stepQuantity(1)"
          >
            +
          </button>
        </div>
      </FormField>

      <StatusLine v-if="submitError" tone="error">{{ submitError }}</StatusLine>

      <AppButton
        type="submit"
        data-testid="wine-form-submit"
        :disabled="submitting"
        class="self-start"
      >
        {{ isEdit ? 'Save changes' : 'Add wine' }}
      </AppButton>
    </form>
   </div>
  </section>
</template>
