<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Color } from '../api/types'
import AutocompleteField from '../components/AutocompleteField.vue'
import { useAppellations } from '../composables/useAppellations'
import { useWines } from '../composables/useWines'
import {
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

const colors: Color[] = ['rouge', 'blanc', 'rose']

const millesime = ref(emptyWineFormFields.millesime)
const appellationId = ref<number | null>(emptyWineFormFields.appellationId)
const producer = ref(emptyWineFormFields.producer)
const color = ref<Color | ''>(emptyWineFormFields.color)
const gardeDebut = ref(emptyWineFormFields.gardeDebut)
const gardeFin = ref(emptyWineFormFields.gardeFin)
const quantity = ref(emptyWineFormFields.quantity)

const fields = computed<WineFormFields>(() => ({
  millesime: millesime.value,
  appellationId: appellationId.value,
  producer: producer.value,
  color: color.value,
  gardeDebut: gardeDebut.value,
  gardeFin: gardeFin.value,
  quantity: quantity.value,
}))

const errors = ref<WineFormErrors>({})

const showNewAppellation = ref(false)
const newAppellationName = ref('')

const loading = computed(() => appellationsLoading.value || (isEdit.value && wineLoading.value))
const loadError = computed(() =>
  [appellationsError.value, isEdit.value ? wineError.value : null]
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
    producer.value = prefilled.producer
    color.value = prefilled.color
    gardeDebut.value = prefilled.gardeDebut
    gardeFin.value = prefilled.gardeFin
    quantity.value = prefilled.quantity
  },
  { immediate: true },
)

onMounted(() => {
  loadAppellations()
  if (editId.value !== null) loadWine(editId.value)
})

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

async function submit() {
  const validationErrors = validateWineForm(fields.value)
  errors.value = validationErrors
  if (Object.keys(validationErrors).length > 0) return

  const input = toWineInput(fields.value)
  const saved = isEdit.value ? await updateWine(editId.value as number, input) : await createWine(input)

  if (saved) router.push({ name: 'wine-detail', params: { id: saved.id } })
}
</script>

<template>
  <section class="px-6 py-4">
    <h2 class="font-serif text-xl text-stone-900">{{ isEdit ? 'Edit wine' : 'Add wine' }}</h2>

    <p v-if="loading" role="status" class="text-stone-600">Loading…</p>
    <p v-else-if="hasLoadError" role="alert" class="text-red-700">Couldn't load: {{ loadError }}</p>
    <form
      v-else
      data-testid="wine-form"
      class="mt-4 flex max-w-md flex-col gap-3"
      @submit.prevent="submit"
    >
      <label class="flex flex-col text-sm text-stone-700">
        Millesime
        <input v-model="millesime" data-testid="wine-millesime-input" type="number" />
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Appellation
        <AutocompleteField
          testid="wine-appellation"
          :items="appellations"
          :model-value="appellationId"
          placeholder="Pick an appellation"
          @update:model-value="(v) => (appellationId = v)"
        />
        <p v-if="errors.appellationId" data-testid="wine-appellation-error" class="text-xs text-red-700">
          {{ errors.appellationId }}
        </p>
        <button
          type="button"
          data-testid="new-appellation-toggle"
          class="mt-1 self-start text-xs text-stone-600 underline"
          @click="toggleNewAppellation"
        >
          {{ showNewAppellation ? 'Cancel' : "Can't find it? Create new appellation" }}
        </button>
        <div v-if="showNewAppellation" class="mt-1 flex items-center gap-2">
          <input
            v-model="newAppellationName"
            data-testid="new-appellation-name-input"
            type="text"
            placeholder="New appellation name"
            class="rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            data-testid="new-appellation-submit"
            :disabled="creatingAppellation"
            class="rounded bg-stone-800 px-2 py-1 text-xs text-white disabled:opacity-50"
            @click="submitNewAppellation"
          >
            Create
          </button>
        </div>
        <p v-if="appellationCreateError" data-testid="new-appellation-error" class="text-xs text-red-700">
          {{ appellationCreateError }}
        </p>
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Producer
        <input v-model="producer" data-testid="wine-producer-input" type="text" />
        <p v-if="errors.producer" data-testid="wine-producer-error" class="text-xs text-red-700">
          {{ errors.producer }}
        </p>
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Color
        <select v-model="color" data-testid="wine-color-input">
          <option value="">Choose a color</option>
          <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
        </select>
        <p v-if="errors.color" data-testid="wine-color-error" class="text-xs text-red-700">
          {{ errors.color }}
        </p>
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Garde start
        <input v-model="gardeDebut" data-testid="wine-garde-debut-input" type="number" />
        <p v-if="errors.gardeDebut" data-testid="wine-garde-debut-error" class="text-xs text-red-700">
          {{ errors.gardeDebut }}
        </p>
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Garde end
        <input v-model="gardeFin" data-testid="wine-garde-fin-input" type="number" />
        <p v-if="errors.gardeFin" data-testid="wine-garde-fin-error" class="text-xs text-red-700">
          {{ errors.gardeFin }}
        </p>
      </label>

      <label class="flex flex-col text-sm text-stone-700">
        Quantity
        <input v-model="quantity" data-testid="wine-quantity-input" type="number" />
        <p v-if="errors.quantity" data-testid="wine-quantity-error" class="text-xs text-red-700">
          {{ errors.quantity }}
        </p>
      </label>

      <p v-if="submitError" role="alert" class="text-red-700">{{ submitError }}</p>

      <button
        type="submit"
        data-testid="wine-form-submit"
        :disabled="submitting"
        class="self-start rounded bg-stone-800 px-3 py-1 text-white disabled:opacity-50"
      >
        {{ isEdit ? 'Save changes' : 'Add wine' }}
      </button>
    </form>
  </section>
</template>
