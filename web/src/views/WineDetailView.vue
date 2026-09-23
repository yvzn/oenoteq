<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FormField from '../components/FormField.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useSuccessMessage } from '../composables/useSuccessMessage'
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

const consumptionSuccess = useSuccessMessage()

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
    consumptionSuccess.show('Consumption recorded.')
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

function retry() {
  loadWine(id.value)
}
</script>

<template>
  <section class="px-6 py-6">
    <StatusLine v-if="loading">Loading wine…</StatusLine>
    <StatusLine v-else-if="hasError" tone="error">
      Couldn't load this wine: {{ error }}
      <template #retry>
        <AppButton variant="ghost" data-testid="wine-detail-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <div v-else-if="wine" data-testid="wine-detail" class="max-w-2xl">
      <div class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex items-center gap-3.5">
          <ColorSwatch :color="wine.color" variant="rail" class="h-[34px]" />
          <h1 class="font-display text-ink text-[32px] leading-tight font-semibold tracking-tight">
            {{ wine.producer }}
          </h1>
        </div>
        <div class="flex items-center gap-5 pt-2">
          <RouterLink
            :to="{
              name: 'meal-pairings',
              query: { appellation_id: wine.appellation_id, color: wine.color },
            }"
            data-testid="manage-pairings-link"
            class="text-muted hover:text-ink text-sm font-medium"
          >
            Manage pairings
          </RouterLink>
          <RouterLink
            :to="{ name: 'wine-edit', params: { id: wine.id } }"
            data-testid="edit-wine-link"
            class="text-bordeaux text-sm font-medium"
          >
            Edit
          </RouterLink>
        </div>
      </div>

      <div class="text-muted mt-3.5 mb-[26px] ml-[19px] flex flex-wrap items-center gap-3 text-[14.5px]">
        <span class="capitalize">{{ wine.color }}</span>
        <span class="text-muted/40">·</span>
        <span>{{ appellationName }}</span>
        <span class="text-muted/40">·</span>
        <span class="text-ink-soft tabular-nums">{{ wine.millesime ?? 'NV' }}</span>
        <span class="border-line text-muted rounded-full border px-[11px] py-1 text-[13px]">
          Garde {{ wine.garde_debut }}–{{ wine.garde_fin }}
        </span>
        <GardeStatusBadge v-if="gardeStatus" :status="gardeStatus" />
        <span class="text-ink-soft ml-1 tabular-nums">×{{ wine.quantity }}</span>
      </div>

      <section class="border-line border-t pt-[26px] pb-[26px]">
        <h2 class="font-display text-ink mb-4 text-[20px] font-semibold">Suggested meals</h2>
        <StatusLine v-if="wine.suggested_meals.length === 0">No suggestions yet.</StatusLine>
        <ul v-else data-testid="suggested-meals" class="flex flex-col gap-2.5 text-[15px]">
          <li
            v-for="meal in wine.suggested_meals"
            :key="meal.id"
            data-testid="suggested-meal"
            class="flex items-center gap-2.5"
          >
            <span class="bg-bordeaux h-1.5 w-1.5 shrink-0 rounded-full"></span>
            {{ meal.name }}
          </li>
        </ul>
      </section>

      <section class="border-line border-t pt-[26px] pb-[26px]">
        <h2 class="font-display text-ink mb-4 text-[20px] font-semibold">Consumption history</h2>
        <StatusLine v-if="wine.consumption_history.length === 0">No consumptions recorded yet.</StatusLine>
        <ul v-else data-testid="consumption-history" class="flex flex-col">
          <li
            v-for="(consumption, index) in wine.consumption_history"
            :key="consumption.id"
            data-testid="consumption-entry"
            class="flex items-baseline gap-3 py-[11px]"
            :class="index < wine.consumption_history.length - 1 ? 'border-line border-b' : ''"
          >
            <span class="text-ink w-[100px] text-[15px] font-semibold tabular-nums">{{ consumption.date }}</span>
            <span v-if="consumption.rating !== null" class="text-muted text-[14.5px]">Rating: {{ consumption.rating }}</span>
            <span v-if="consumption.notes" class="text-muted text-[14.5px]">{{ consumption.notes }}</span>
          </li>
        </ul>
      </section>

      <section class="border-line border-t pt-[26px]">
        <h2 class="font-display text-ink mb-[18px] text-[20px] font-semibold">Record a consumption</h2>
        <StatusLine v-if="wine.quantity === 0" data-testid="consumption-blocked-message">
          No bottles left to record a consumption — quantity is already 0.
        </StatusLine>
        <form
          v-else
          data-testid="consumption-form"
          class="bg-surface border-line flex flex-col gap-3 rounded-xl border px-[22px] py-5"
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
