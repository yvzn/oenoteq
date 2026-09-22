<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import { useAppellations } from '../composables/useAppellations'
import { useWines } from '../composables/useWines'
import { computeGardeStatus } from '../domain/gardeStatus'

const route = useRoute()

const { wine, loading: wineLoading, error: wineError, load: loadWine } = useWines()
const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()

const id = computed(() => Number(route.params.id))

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

watch(id, (next) => loadWine(next), { immediate: true })

onMounted(() => {
  loadAppellations()
})
</script>

<template>
  <section class="px-6 py-4">
    <p v-if="loading" role="status" class="text-stone-600">Loading wine…</p>
    <p v-else-if="hasError" role="alert" class="text-red-700">
      Couldn't load this wine: {{ error }}
    </p>
    <div v-else-if="wine" data-testid="wine-detail">
      <h2 class="font-serif text-xl text-stone-900">{{ wine.producer }}</h2>
      <div class="mt-2 flex flex-wrap items-center gap-3 text-stone-700">
        <span>{{ appellationName }}</span>
        <span>{{ wine.millesime ?? 'NV' }}</span>
        <span>{{ wine.color }}</span>
        <span>Garde: {{ wine.garde_debut }}–{{ wine.garde_fin }}</span>
        <GardeStatusBadge v-if="gardeStatus" :status="gardeStatus" />
        <span>Qty: {{ wine.quantity }}</span>
      </div>

      <section class="mt-6">
        <h3 class="font-serif text-lg text-stone-900">Suggested meals</h3>
        <p v-if="wine.suggested_meals.length === 0" class="text-stone-600">No suggestions yet.</p>
        <ul v-else data-testid="suggested-meals">
          <li v-for="meal in wine.suggested_meals" :key="meal.id" data-testid="suggested-meal">
            {{ meal.name }}
          </li>
        </ul>
      </section>

      <section class="mt-6">
        <h3 class="font-serif text-lg text-stone-900">Consumption history</h3>
        <p v-if="wine.consumption_history.length === 0" class="text-stone-600">
          No consumptions recorded yet.
        </p>
        <ul v-else data-testid="consumption-history">
          <li
            v-for="consumption in wine.consumption_history"
            :key="consumption.id"
            data-testid="consumption-entry"
          >
            <span>{{ consumption.date }}</span>
            <span v-if="consumption.rating !== null">Rating: {{ consumption.rating }}</span>
            <span v-if="consumption.notes">{{ consumption.notes }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
