<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FilterBar from '../components/FilterBar.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
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

function loadFilterOptions() {
  loadAppellations()
  loadMeals()
}

function retry() {
  loadFilterOptions()
  search(filters.value)
}

watch(filters, (next) => search(next), { immediate: true })

onMounted(loadFilterOptions)
</script>

<template>
  <section>
    <FilterBar
      :filters="filters"
      :appellations="appellations"
      :meals="meals"
      @update:filters="updateFilters"
    />

    <div class="max-w-4xl px-6 py-6">
      <PageHeader title="Cellar">
        <template #actions>
          <AppButton :to="{ name: 'wine-new' }" data-testid="add-wine-link">Add wine</AppButton>
        </template>
      </PageHeader>

      <StatusLine v-if="loading" class="mt-6">Loading your cellar…</StatusLine>
      <StatusLine v-else-if="hasError" tone="error" class="mt-6">
        Couldn't load your cellar: {{ error }}
        <template #retry>
          <AppButton variant="ghost" data-testid="cellar-retry" @click="retry">Retry</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="results.length === 0" class="mt-6">
        No wines match these filters.
      </StatusLine>
      <template v-else>
        <div class="mt-8 grid grid-cols-[5px_1fr_78px_60px_118px] gap-5 px-[22px]">
          <div></div>
          <div class="text-label text-xs font-medium">Wine</div>
          <div class="text-label text-right text-xs font-medium">Vintage</div>
          <div class="text-label text-right text-xs font-medium">Qty</div>
          <div class="text-label text-right text-xs font-medium">Status</div>
        </div>
        <ul data-testid="wine-list" class="mt-2 flex flex-col gap-2.5">
          <li v-for="wine in results" :key="wine.id" data-testid="wine-item">
            <RouterLink
              :to="{ name: 'wine-detail', params: { id: wine.id } }"
              data-testid="wine-link"
              class="border-line bg-surface hover:border-gold grid grid-cols-[5px_1fr_78px_60px_118px] items-center gap-5 rounded-[10px] border px-[22px] py-4 shadow-sm transition-colors"
            >
              <ColorSwatch :color="wine.color" variant="rail" />
              <div class="min-w-0">
                <div class="font-display text-ink text-[19px] leading-[1.25] font-semibold">
                  {{ wine.producer }}
                </div>
                <div class="text-muted mt-0.5 text-[13.5px] capitalize">
                  {{ wine.color }} · {{ appellationName(wine.appellation_id) }}
                </div>
              </div>
              <div class="text-ink-soft text-right text-[15px] tabular-nums">
                {{ wine.millesime ?? 'NV' }}
              </div>
              <div class="text-ink-soft text-right text-[15px] tabular-nums">×{{ wine.quantity }}</div>
              <div class="text-right"><GardeStatusBadge :status="wine.garde_status" /></div>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
