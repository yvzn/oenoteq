<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FormField from '../components/FormField.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useWines } from '../composables/useWines'
import { computeGardeStatus } from '../domain/gardeStatus'

const route = useRoute()

const {
  wine,
  loading: wineLoading,
  error: wineError,
  load: loadWine,
  recordConsumption,
  submittingConsumption,
  consumptionError,
} = useWines()
const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()

const id = computed(() => Number(route.params.id))

const consumptionDate = ref('')
const consumptionRating = ref('')
const consumptionNotes = ref('')

async function submitConsumption() {
  await recordConsumption(id.value, {
    date: consumptionDate.value,
    rating: consumptionRating.value === '' ? null : Number(consumptionRating.value),
    notes: consumptionNotes.value === '' ? null : consumptionNotes.value,
  })
  if (!consumptionError.value) {
    consumptionDate.value = ''
    consumptionRating.value = ''
    consumptionNotes.value = ''
  }
}

const loading = computed(() => wineLoading.value || appellationsLoading.value)
const error = computed(() =>
  [wineError.value, appellationsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasError = computed(() => error.value !== '')

const appellationName = computed(() => {
  if (!wine.value) return ''
  return appellations.value.find((a) => a.id === wine.value!.appellation_id)?.name ?? 'Unknown appellation'
})

const gardeStatus = computed(() => (wine.value ? computeGardeStatus(wine.value) : null))

watch(
  id,
  (next) => {
    consumptionError.value = null
    consumptionDate.value = ''
    consumptionRating.value = ''
    consumptionNotes.value = ''
    loadWine(next)
  },
  { immediate: true },
)

onMounted(() => {
  loadAppellations()
})
</script>

<template>
  <section class="px-6 py-6">
    <StatusLine v-if="loading">Loading wine…</StatusLine>
    <StatusLine v-else-if="hasError" tone="error">Couldn't load this wine: {{ error }}</StatusLine>
    <div v-else-if="wine" data-testid="wine-detail" class="max-w-2xl">
      <PageHeader :title="wine.producer">
        <template #actions>
          <RouterLink
            :to="{
              name: 'meal-pairings',
              query: { appellation_id: wine.appellation_id, color: wine.color },
            }"
            data-testid="manage-pairings-link"
            class="text-muted hover:text-ink text-sm underline underline-offset-2"
          >
            Manage pairings
          </RouterLink>
          <RouterLink
            :to="{ name: 'wine-edit', params: { id: wine.id } }"
            data-testid="edit-wine-link"
            class="text-muted hover:text-ink text-sm underline underline-offset-2"
          >
            Edit
          </RouterLink>
        </template>
      </PageHeader>
      <div class="text-muted mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span class="flex items-center gap-1.5"><ColorSwatch :color="wine.color" />{{ wine.color }}</span>
        <span>{{ appellationName }}</span>
        <span>{{ wine.millesime ?? 'NV' }}</span>
        <span>Garde: {{ wine.garde_debut }}–{{ wine.garde_fin }}</span>
        <GardeStatusBadge v-if="gardeStatus" :status="gardeStatus" />
        <span>Qty: {{ wine.quantity }}</span>
      </div>

      <section class="border-line mt-8 border-t pt-6">
        <h3 class="font-display text-ink text-lg">Suggested meals</h3>
        <StatusLine v-if="wine.suggested_meals.length === 0" class="mt-2">No suggestions yet.</StatusLine>
        <ul v-else data-testid="suggested-meals" class="mt-2 flex flex-col gap-1 text-sm">
          <li v-for="meal in wine.suggested_meals" :key="meal.id" data-testid="suggested-meal">
            {{ meal.name }}
          </li>
        </ul>
      </section>

      <section class="border-line mt-8 border-t pt-6">
        <h3 class="font-display text-ink text-lg">Consumption history</h3>
        <StatusLine v-if="wine.consumption_history.length === 0" class="mt-2">
          No consumptions recorded yet.
        </StatusLine>
        <ul v-else data-testid="consumption-history" class="mt-2 flex flex-col gap-2 text-sm">
          <li
            v-for="consumption in wine.consumption_history"
            :key="consumption.id"
            data-testid="consumption-entry"
            class="border-line border-b pb-2"
          >
            <span class="text-ink font-medium">{{ consumption.date }}</span>
            <span v-if="consumption.rating !== null" class="text-muted ml-2">Rating: {{ consumption.rating }}</span>
            <span v-if="consumption.notes" class="text-muted ml-2">{{ consumption.notes }}</span>
          </li>
        </ul>
      </section>

      <section class="border-line mt-8 border-t pt-6">
        <h3 class="font-display text-ink text-lg">Record a consumption</h3>
        <StatusLine v-if="wine.quantity === 0" data-testid="consumption-blocked-message" class="mt-2">
          No bottles left to record a consumption — quantity is already 0.
        </StatusLine>
        <form
          v-else
          data-testid="consumption-form"
          class="mt-3 flex max-w-sm flex-col gap-3"
          @submit.prevent="submitConsumption"
        >
          <FormField label="Date">
            <input v-model="consumptionDate" data-testid="consumption-date-input" type="date" required />
          </FormField>
          <FormField label="Rating (1–5)">
            <input
              v-model="consumptionRating"
              data-testid="consumption-rating-input"
              type="number"
              min="1"
              max="5"
            />
          </FormField>
          <FormField label="Notes">
            <textarea v-model="consumptionNotes" data-testid="consumption-notes-input"></textarea>
          </FormField>
          <StatusLine v-if="consumptionError" tone="error">{{ consumptionError }}</StatusLine>
          <AppButton type="submit" :disabled="submittingConsumption" class="self-start" data-testid="consumption-submit">
            Record
          </AppButton>
        </form>
      </section>
    </div>
  </section>
</template>
