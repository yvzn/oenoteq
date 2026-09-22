<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilterBar from '../components/FilterBar.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import { useAppellations } from '../composables/useAppellations'
import { useMeals } from '../composables/useMeals'
import { useSearch } from '../composables/useSearch'
import { filtersToQueryParams, queryParamsToFilters, type SearchFilters } from '../domain/searchFilters'

const route = useRoute()
const router = useRouter()

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()
const { meals, loading: mealsLoading, error: mealsError, load: loadMeals } = useMeals()
const { results, loading: searchLoading, error: searchError, search } = useSearch()

const filters = computed<SearchFilters>(() => queryParamsToFilters(route.query))

const loading = computed(
  () => appellationsLoading.value || mealsLoading.value || searchLoading.value,
)
const error = computed(() =>
  [appellationsError.value, mealsError.value, searchError.value]
    .filter((e): e is string => e !== null)
    .join('; '),
)
const hasError = computed(() => error.value !== '')

const appellationNameById = computed(() => {
  const map = new Map<number, string>()
  for (const a of appellations.value) map.set(a.id, a.name)
  return map
})

function appellationName(appellationId: number): string {
  return appellationNameById.value.get(appellationId) ?? 'Unknown appellation'
}

function updateFilters(next: SearchFilters) {
  router.push({ query: filtersToQueryParams(next) })
}

watch(filters, (next) => search(next), { immediate: true })

onMounted(() => {
  loadAppellations()
  loadMeals()
})
</script>

<template>
  <section>
    <FilterBar
      :filters="filters"
      :appellations="appellations"
      :meals="meals"
      @update:filters="updateFilters"
    />

    <div class="px-6 py-4">
      <p v-if="loading" role="status" class="text-stone-600">Loading your cellar…</p>
      <p v-else-if="hasError" role="alert" class="text-red-700">
        Couldn't load your cellar: {{ error }}
      </p>
      <ul v-else data-testid="wine-list" class="divide-y divide-stone-200">
        <li
          v-for="wine in results"
          :key="wine.id"
          data-testid="wine-item"
          class="flex flex-wrap items-center gap-3 py-3"
        >
          <span class="font-medium text-stone-900">{{ wine.producer }}</span>
          <span class="text-stone-600">{{ appellationName(wine.appellation_id) }}</span>
          <span class="text-stone-600">{{ wine.millesime ?? 'NV' }}</span>
          <span class="text-stone-600">{{ wine.color }}</span>
          <span class="text-stone-600">Qty: {{ wine.quantity }}</span>
          <GardeStatusBadge :status="wine.garde_status" />
        </li>
      </ul>
    </div>
  </section>
</template>
